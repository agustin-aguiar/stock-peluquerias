-- 0003_rpc_catalog.sql — helpers de validación y RPC de sucursales, productos y perfiles.

create or replace function public.raise_error(p_code text, p_detail text)
returns void language plpgsql as $$
begin
  raise exception using message = p_code, detail = p_detail, errcode = 'P0001';
end;
$$;

-- Perfil activo del usuario de la sesión, o error.
create or replace function public.assert_active()
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.profiles;
begin
  if auth.uid() is null then
    perform public.raise_error('not_authenticated', 'Iniciá sesión para continuar.');
  end if;
  select * into v from public.profiles where auth_user_id = auth.uid() limit 1;
  if v.id is null then
    perform public.raise_error('no_profile', 'Tu cuenta no tiene un perfil asignado.');
  end if;
  if not v.is_active then
    perform public.raise_error('inactive_user', 'Tu usuario fue desactivado.');
  end if;
  return v;
end;
$$;

create or replace function public.assert_admin()
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v public.profiles;
begin
  v := public.assert_active();
  if v.role <> 'admin' then
    perform public.raise_error('permission_denied', 'Esta acción requiere perfil de administrador.');
  end if;
  return v;
end;
$$;

-- Cantidad válida para la unidad: no nula, no negativa, entera si 'unit', máx. 2 decimales si ml/g.
create or replace function public.assert_quantity_scale(p_qty numeric, p_unit public.unit_kind)
returns void language plpgsql as $$
begin
  if p_qty is null then
    perform public.raise_error('invalid_quantity', 'La cantidad es obligatoria.');
  end if;
  if p_qty < 0 then
    perform public.raise_error('invalid_quantity', 'La cantidad no puede ser negativa.');
  end if;
  if p_unit = 'unit' and p_qty <> trunc(p_qty) then
    perform public.raise_error('invalid_quantity', 'Los productos por unidad solo admiten cantidades enteras.');
  end if;
  if p_unit in ('ml', 'g') and scale(p_qty) > 2 then
    perform public.raise_error('invalid_quantity', 'Se admiten hasta dos decimales.');
  end if;
end;
$$;

create or replace function public.log_audit(
  p_actor uuid, p_chain uuid, p_action text, p_entity_type text, p_entity_id uuid, p_old jsonb, p_new jsonb)
returns void language sql as $$
  insert into public.audit_events (chain_id, actor_profile_id, action, entity_type, entity_id, old_values, new_values)
  values (p_chain, p_actor, p_action, p_entity_type, p_entity_id, p_old, p_new);
$$;

revoke execute on function
  public.raise_error(text, text),
  public.assert_active(),
  public.assert_admin(),
  public.assert_quantity_scale(numeric, public.unit_kind),
  public.log_audit(uuid, uuid, text, text, uuid, jsonb, jsonb)
from public, anon, authenticated;

-- Sucursales -------------------------------------------------------------

create or replace function public.create_branch(p_code text, p_name text)
returns public.branches language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_row public.branches;
begin
  v_actor := public.assert_admin();
  if p_code is null or p_code !~ '^[A-Z0-9]{2,8}$' then
    perform public.raise_error('invalid_code', 'El código debe tener entre 2 y 8 letras mayúsculas o números.');
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    perform public.raise_error('invalid_name', 'El nombre es obligatorio.');
  end if;
  if exists (select 1 from public.branches where chain_id = v_actor.chain_id and code = p_code) then
    perform public.raise_error('duplicate_code', 'Ya existe una sucursal con ese código.');
  end if;
  insert into public.branches (chain_id, code, name)
  values (v_actor.chain_id, p_code, trim(p_name))
  returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'branch.create', 'branch', v_row.id, null, to_jsonb(v_row));
  return v_row;
end;
$$;

create or replace function public.update_branch(p_id uuid, p_name text, p_is_active boolean)
returns public.branches language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_old public.branches; v_row public.branches;
begin
  v_actor := public.assert_admin();
  select * into v_old from public.branches where id = p_id and chain_id = v_actor.chain_id for update;
  if v_old.id is null then
    perform public.raise_error('not_found', 'La sucursal no existe.');
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    perform public.raise_error('invalid_name', 'El nombre es obligatorio.');
  end if;
  if v_old.is_active and not coalesce(p_is_active, true) then
    if exists (select 1 from public.inventory where branch_id = p_id and balance > 0) then
      perform public.raise_error('has_stock', 'La sucursal tiene productos con saldo; no se puede desactivar.');
    end if;
    if exists (select 1 from public.transfers
                where (from_branch_id = p_id or to_branch_id = p_id)
                  and status in ('draft', 'dispatched', 'disputed')) then
      perform public.raise_error('has_open_transfers', 'La sucursal tiene transferencias abiertas.');
    end if;
    if exists (select 1 from public.profiles where branch_id = p_id and is_active) then
      perform public.raise_error('has_active_users', 'La sucursal tiene usuarios activos asignados.');
    end if;
  end if;
  update public.branches set name = trim(p_name), is_active = coalesce(p_is_active, true)
   where id = p_id returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'branch.update', 'branch', p_id, to_jsonb(v_old), to_jsonb(v_row));
  return v_row;
end;
$$;

-- Productos --------------------------------------------------------------

create or replace function public.upsert_product(
  p_sku text,
  p_name text,
  p_unit public.unit_kind,
  p_id uuid default null,
  p_brand text default null,
  p_category text default null,
  p_variant text default null,
  p_presentation text default null,
  p_presentation_qty numeric default null,
  p_max_movement_qty numeric default 100000,
  p_is_active boolean default true)
returns public.products language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_old public.products; v_row public.products;
begin
  v_actor := public.assert_admin();
  if p_sku is null or p_sku !~ '^[A-Za-z0-9._-]{1,40}$' then
    perform public.raise_error('invalid_sku', 'El SKU admite letras, números, punto, guion y guion bajo (máximo 40).');
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    perform public.raise_error('invalid_name', 'El nombre es obligatorio.');
  end if;
  if p_unit is null then
    perform public.raise_error('invalid_unit', 'La unidad es obligatoria.');
  end if;
  if p_presentation_qty is not null then
    if p_presentation_qty <= 0 then
      perform public.raise_error('invalid_quantity', 'El contenido por envase debe ser mayor que cero.');
    end if;
    perform public.assert_quantity_scale(p_presentation_qty, p_unit);
  end if;
  if p_max_movement_qty is null or p_max_movement_qty <= 0 then
    perform public.raise_error('invalid_quantity', 'El máximo por movimiento debe ser mayor que cero.');
  end if;
  if exists (select 1 from public.products
              where chain_id = v_actor.chain_id and lower(sku) = lower(p_sku)
                and (p_id is null or id <> p_id)) then
    perform public.raise_error('duplicate_sku', 'Ya existe un producto con ese SKU.');
  end if;

  if p_id is null then
    insert into public.products
      (chain_id, sku, name, brand, category, variant, unit, presentation, presentation_qty, max_movement_qty, is_active)
    values
      (v_actor.chain_id, p_sku, trim(p_name), nullif(trim(p_brand), ''), nullif(trim(p_category), ''),
       nullif(trim(p_variant), ''), p_unit, nullif(trim(p_presentation), ''), p_presentation_qty,
       p_max_movement_qty, coalesce(p_is_active, true))
    returning * into v_row;
    perform public.log_audit(v_actor.id, v_actor.chain_id, 'product.create', 'product', v_row.id, null, to_jsonb(v_row));
    return v_row;
  end if;

  select * into v_old from public.products where id = p_id and chain_id = v_actor.chain_id for update;
  if v_old.id is null then
    perform public.raise_error('not_found', 'El producto no existe.');
  end if;
  if v_old.unit <> p_unit then
    if exists (select 1 from public.movements where product_id = p_id)
       or exists (select 1 from public.inventory where product_id = p_id and initialized_at is not null) then
      perform public.raise_error('unit_locked', 'La unidad no se puede cambiar: el producto ya tiene saldo o movimientos.');
    end if;
    if p_unit = 'unit' and exists (select 1 from public.inventory where product_id = p_id and min_qty <> trunc(min_qty)) then
      perform public.raise_error('invalid_quantity', 'Hay mínimos con decimales; corregilos antes de cambiar la unidad.');
    end if;
  end if;
  if v_old.is_active and not coalesce(p_is_active, true) then
    if exists (select 1 from public.inventory where product_id = p_id and balance > 0) then
      perform public.raise_error('has_stock', 'El producto tiene saldo en alguna sucursal.');
    end if;
    if exists (select 1 from public.transfers where product_id = p_id and status in ('draft', 'dispatched', 'disputed')) then
      perform public.raise_error('has_open_transfers', 'El producto tiene transferencias abiertas.');
    end if;
  end if;
  update public.products
     set sku = p_sku, name = trim(p_name), brand = nullif(trim(p_brand), ''), category = nullif(trim(p_category), ''),
         variant = nullif(trim(p_variant), ''), unit = p_unit, presentation = nullif(trim(p_presentation), ''),
         presentation_qty = p_presentation_qty, max_movement_qty = p_max_movement_qty,
         is_active = coalesce(p_is_active, true)
   where id = p_id returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'product.update', 'product', p_id, to_jsonb(v_old), to_jsonb(v_row));
  return v_row;
end;
$$;

-- Perfiles ---------------------------------------------------------------

create or replace function public.create_profile(
  p_email text, p_full_name text, p_role public.user_role, p_branch_id uuid default null)
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_row public.profiles; v_branch uuid := p_branch_id;
begin
  v_actor := public.assert_admin();
  if p_email is null or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    perform public.raise_error('invalid_email', 'El email no es válido.');
  end if;
  if p_full_name is null or length(trim(p_full_name)) = 0 then
    perform public.raise_error('invalid_name', 'El nombre es obligatorio.');
  end if;
  if p_role is null then
    perform public.raise_error('invalid_role', 'El rol es obligatorio.');
  end if;
  if p_role = 'operator' then
    if v_branch is null then
      perform public.raise_error('branch_required', 'Un operador necesita una sucursal asignada.');
    end if;
    if not exists (select 1 from public.branches where id = v_branch and chain_id = v_actor.chain_id and is_active) then
      perform public.raise_error('branch_inactive', 'La sucursal no existe o está inactiva.');
    end if;
  else
    v_branch := null;
  end if;
  if exists (select 1 from public.profiles where chain_id = v_actor.chain_id and lower(email) = lower(trim(p_email))) then
    perform public.raise_error('duplicate_email', 'Ya existe un usuario con ese email.');
  end if;
  insert into public.profiles (chain_id, email, full_name, role, branch_id)
  values (v_actor.chain_id, lower(trim(p_email)), trim(p_full_name), p_role, v_branch)
  returning * into v_row;
  -- Si la cuenta Auth ya existe, vincularla ahora.
  update public.profiles p
     set auth_user_id = u.id
    from auth.users u
   where p.id = v_row.id
     and lower(u.email) = lower(v_row.email)
     and not exists (select 1 from public.profiles q where q.auth_user_id = u.id);
  select * into v_row from public.profiles where id = v_row.id;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'profile.create', 'profile', v_row.id, null, to_jsonb(v_row));
  return v_row;
end;
$$;

create or replace function public.update_profile(
  p_id uuid, p_full_name text, p_role public.user_role, p_branch_id uuid default null, p_is_active boolean default true)
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_old public.profiles; v_row public.profiles; v_branch uuid := p_branch_id; v_other_admins int;
begin
  v_actor := public.assert_admin();
  select * into v_old from public.profiles where id = p_id and chain_id = v_actor.chain_id for update;
  if v_old.id is null then
    perform public.raise_error('not_found', 'El usuario no existe.');
  end if;
  if p_full_name is null or length(trim(p_full_name)) = 0 then
    perform public.raise_error('invalid_name', 'El nombre es obligatorio.');
  end if;
  if p_role is null then
    perform public.raise_error('invalid_role', 'El rol es obligatorio.');
  end if;
  if p_id = v_actor.id and not coalesce(p_is_active, true) then
    perform public.raise_error('self_deactivation', 'No podés desactivar tu propio usuario.');
  end if;
  if p_role = 'operator' then
    if v_branch is null then
      perform public.raise_error('branch_required', 'Un operador necesita una sucursal asignada.');
    end if;
    if not exists (select 1 from public.branches where id = v_branch and chain_id = v_actor.chain_id and is_active) then
      perform public.raise_error('branch_inactive', 'La sucursal no existe o está inactiva.');
    end if;
  else
    v_branch := null;
  end if;
  if not (p_role = 'admin' and coalesce(p_is_active, true)) then
    select count(*) into v_other_admins from public.profiles
     where chain_id = v_actor.chain_id and role = 'admin' and is_active and id <> p_id;
    if v_other_admins = 0 then
      perform public.raise_error('last_admin', 'No se puede desactivar ni degradar al último administrador activo.');
    end if;
  end if;
  update public.profiles
     set full_name = trim(p_full_name), role = p_role, branch_id = v_branch, is_active = coalesce(p_is_active, true)
   where id = p_id returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'profile.update', 'profile', p_id, to_jsonb(v_old), to_jsonb(v_row));
  return v_row;
end;
$$;

revoke execute on function
  public.create_branch(text, text),
  public.update_branch(uuid, text, boolean),
  public.upsert_product(text, text, public.unit_kind, uuid, text, text, text, text, numeric, numeric, boolean),
  public.create_profile(text, text, public.user_role, uuid),
  public.update_profile(uuid, text, public.user_role, uuid, boolean)
from public, anon;
grant execute on function
  public.create_branch(text, text),
  public.update_branch(uuid, text, boolean),
  public.upsert_product(text, text, public.unit_kind, uuid, text, text, text, text, numeric, numeric, boolean),
  public.create_profile(text, text, public.user_role, uuid),
  public.update_profile(uuid, text, public.user_role, uuid, boolean)
to authenticated;
