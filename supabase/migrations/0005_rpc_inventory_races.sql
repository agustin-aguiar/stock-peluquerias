-- 0005_rpc_inventory_races.sql — corrige carreras de unique_violation en 0004_rpc_inventory.sql.
--
-- Reemplaza (create or replace function) `enable_product_in_branch` y `set_initial_balance`
-- de 0004. Ambas funciones validaban con un `select`/`exists` antes de insertar, sin tomar
-- un lock que serialice llamadas concurrentes para la misma clave: dos llamadas simultáneas
-- podían pasar ambas la validación y competir en el `insert`, y la perdedora recibía el error
-- crudo de Postgres `unique_violation` (23505) en lugar del código de error de negocio
-- (`already_enabled` / `idempotency_conflict`).
--
-- Fix: se envuelve cada `insert` sensible en un bloque anidado `begin ... exception when
-- unique_violation then ... end;` que traduce la violación de la restricción única al código
-- esperado por los clientes (y, en `set_initial_balance`, reintenta la lectura de idempotencia
-- para devolver el resultado ya confirmado si la clave y el hash coinciden).
-- El resto de cada función es idéntico a 0004 (mismas firmas, validaciones y auditoría).

create or replace function public.enable_product_in_branch(p_product_id uuid, p_branch_id uuid, p_min_qty numeric default 0)
returns public.inventory language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_prod public.products; v_branch public.branches; v_row public.inventory;
begin
  v_actor := public.assert_admin();
  select * into v_prod from public.products where id = p_product_id and chain_id = v_actor.chain_id;
  if v_prod.id is null then perform public.raise_error('not_found', 'El producto no existe.'); end if;
  if not v_prod.is_active then perform public.raise_error('product_inactive', 'El producto está inactivo.'); end if;
  select * into v_branch from public.branches where id = p_branch_id and chain_id = v_actor.chain_id;
  if v_branch.id is null then perform public.raise_error('not_found', 'La sucursal no existe.'); end if;
  if not v_branch.is_active then perform public.raise_error('branch_inactive', 'La sucursal está inactiva.'); end if;
  perform public.assert_quantity_scale(coalesce(p_min_qty, 0), v_prod.unit);
  if exists (select 1 from public.inventory where branch_id = p_branch_id and product_id = p_product_id) then
    perform public.raise_error('already_enabled', 'El producto ya está habilitado en esa sucursal.');
  end if;
  begin
    insert into public.inventory (chain_id, branch_id, product_id, min_qty)
    values (v_actor.chain_id, p_branch_id, p_product_id, coalesce(p_min_qty, 0))
    returning * into v_row;
  exception when unique_violation then
    perform public.raise_error('already_enabled', 'El producto ya está habilitado en esa sucursal.');
  end;
  perform public.recalc_alert(p_branch_id, p_product_id);
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'inventory.enable', 'inventory', v_row.id, null, to_jsonb(v_row));
  return v_row;
end;
$$;

create or replace function public.set_initial_balance(
  p_key uuid, p_branch_id uuid, p_product_id uuid, p_qty numeric, p_reference text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor public.profiles; v_hash text; v_existing public.operations; v_prod public.products;
  v_branch public.branches; v_inv public.inventory; v_op public.operations; v_mov_id uuid; v_result jsonb;
begin
  v_actor := public.assert_admin();
  if p_key is null then perform public.raise_error('invalid_key', 'Falta el identificador de la operación.'); end if;
  v_hash := md5(concat_ws('|', p_branch_id::text, p_product_id::text, p_qty::text, coalesce(p_reference, '')));

  select * into v_existing from public.operations where chain_id = v_actor.chain_id and idempotency_key = p_key;
  if v_existing.id is not null then
    if v_existing.request_hash = v_hash then return v_existing.result; end if;
    perform public.raise_error('idempotency_conflict', 'Esta operación ya se envió con otros datos.');
  end if;

  select * into v_prod from public.products where id = p_product_id and chain_id = v_actor.chain_id;
  if v_prod.id is null then perform public.raise_error('not_found', 'El producto no existe.'); end if;
  if not v_prod.is_active then perform public.raise_error('product_inactive', 'El producto está inactivo.'); end if;
  select * into v_branch from public.branches where id = p_branch_id and chain_id = v_actor.chain_id;
  if v_branch.id is null then perform public.raise_error('not_found', 'La sucursal no existe.'); end if;
  if not v_branch.is_active then perform public.raise_error('branch_inactive', 'La sucursal está inactiva.'); end if;
  perform public.assert_quantity_scale(p_qty, v_prod.unit);
  if p_qty > v_prod.max_movement_qty then
    perform public.raise_error('invalid_quantity', 'La cantidad supera el máximo por movimiento del producto.');
  end if;

  select * into v_inv from public.inventory where branch_id = p_branch_id and product_id = p_product_id for update;
  if v_inv.id is null then perform public.raise_error('not_enabled', 'El producto no está habilitado en esa sucursal.'); end if;

  -- Re-chequeo tras el bloqueo: un reintento concurrente con la misma clave pudo confirmarse mientras esperábamos.
  select * into v_existing from public.operations where chain_id = v_actor.chain_id and idempotency_key = p_key;
  if v_existing.id is not null then
    if v_existing.request_hash = v_hash then return v_existing.result; end if;
    perform public.raise_error('idempotency_conflict', 'Esta operación ya se envió con otros datos.');
  end if;

  if v_inv.initialized_at is not null
     or exists (select 1 from public.movements where branch_id = p_branch_id and product_id = p_product_id) then
    perform public.raise_error('already_initialized', 'El saldo inicial ya fue registrado.');
  end if;

  begin
    insert into public.operations (chain_id, type, actor_profile_id, idempotency_key, request_hash, reference)
    values (v_actor.chain_id, 'initial', v_actor.id, p_key, v_hash, nullif(trim(p_reference), ''))
    returning * into v_op;
  exception when unique_violation then
    select * into v_existing from public.operations where chain_id = v_actor.chain_id and idempotency_key = p_key;
    if v_existing.id is not null and v_existing.request_hash = v_hash then
      return v_existing.result;
    end if;
    perform public.raise_error('idempotency_conflict', 'Esta operación ya se envió con otros datos.');
  end;

  if p_qty > 0 then
    insert into public.movements (chain_id, operation_id, product_id, branch_id, qty_delta, unit)
    values (v_actor.chain_id, v_op.id, p_product_id, p_branch_id, p_qty, v_prod.unit)
    returning id into v_mov_id;
  end if;

  update public.inventory
     set balance = p_qty, initialized_at = now(), version = version + 1, updated_at = now()
   where id = v_inv.id returning * into v_inv;

  perform public.recalc_alert(p_branch_id, p_product_id);

  v_result := jsonb_build_object(
    'operation_id', v_op.id, 'movement_id', v_mov_id, 'balance', v_inv.balance,
    'branch_id', p_branch_id, 'product_id', p_product_id);
  update public.operations set result = v_result where id = v_op.id;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'inventory.initial_balance', 'inventory', v_inv.id, null, v_result);
  return v_result;
end;
$$;

-- Se re-emiten los privilegios para dejar sin ambigüedad los permisos tras el replace.
revoke execute on function
  public.enable_product_in_branch(uuid, uuid, numeric),
  public.set_initial_balance(uuid, uuid, uuid, numeric, text)
from public, anon;
grant execute on function
  public.enable_product_in_branch(uuid, uuid, numeric),
  public.set_initial_balance(uuid, uuid, uuid, numeric, text)
to authenticated;
