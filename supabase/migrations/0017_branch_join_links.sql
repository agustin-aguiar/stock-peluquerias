-- Enlaces de alta por sucursal. Solo el administrador puede emitirlos o revocarlos.
-- El token es aleatorio y se limita por vencimiento y cantidad de usos.
create table public.branch_join_links (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  chain_id uuid not null references public.chains(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null,
  max_uses integer not null default 20 check (max_uses between 1 and 20),
  uses integer not null default 0 check (uses >= 0 and uses <= max_uses),
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.branch_join_links enable row level security;
revoke all on public.branch_join_links from public, anon, authenticated;

create function public.get_branch_join_link(p_branch_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_link public.branch_join_links;
begin
  v_actor := public.assert_admin();
  if not exists (select 1 from public.branches where id = p_branch_id and chain_id = v_actor.chain_id) then
    perform public.raise_error('not_found', 'Sucursal no encontrada.');
  end if;
  select * into v_link from public.branch_join_links where branch_id = p_branch_id;
  if v_link.branch_id is null then return null; end if;
  return to_jsonb(v_link);
end; $$;

create function public.create_branch_join_link(p_branch_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_link public.branch_join_links;
begin
  v_actor := public.assert_admin();
  if not exists (select 1 from public.branches where id = p_branch_id and chain_id = v_actor.chain_id and is_active) then
    perform public.raise_error('branch_inactive', 'Sucursal no encontrada o inactiva.');
  end if;
  insert into public.branch_join_links(branch_id, chain_id, token, expires_at, created_by)
  values (p_branch_id, v_actor.chain_id, gen_random_uuid(), now() + interval '7 days', v_actor.id)
  on conflict (branch_id) do update set
    token = gen_random_uuid(), expires_at = now() + interval '7 days',
    uses = 0, revoked_at = null, created_by = v_actor.id, created_at = now()
  returning * into v_link;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'branch_join_link.create', 'branch', p_branch_id,
    null, jsonb_build_object('expires_at', v_link.expires_at, 'max_uses', v_link.max_uses));
  return to_jsonb(v_link);
end; $$;

create function public.revoke_branch_join_link(p_branch_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles;
begin
  v_actor := public.assert_admin();
  update public.branch_join_links set revoked_at = now()
   where branch_id = p_branch_id and chain_id = v_actor.chain_id;
  if not found then perform public.raise_error('not_found', 'Enlace no encontrado.'); end if;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'branch_join_link.revoke', 'branch', p_branch_id, null, null);
end; $$;

create function public.join_branch_with_link(p_token uuid, p_full_name text)
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v_auth auth.users; v_link public.branch_join_links; v_profile public.profiles;
begin
  if auth.uid() is null then perform public.raise_error('not_authenticated', 'Iniciá sesión.'); end if;
  select * into v_auth from auth.users where id = auth.uid() for update;
  if v_auth.id is null or v_auth.email_confirmed_at is null or v_auth.email is null then
    perform public.raise_error('email_unconfirmed', 'Confirmá tu correo.');
  end if;
  if p_full_name is null or length(trim(p_full_name)) not between 1 and 120 then
    perform public.raise_error('invalid_name', 'Ingresá tu nombre (hasta 120 caracteres).');
  end if;
  select * into v_link from public.branch_join_links where token = p_token for update;
  if v_link.branch_id is null or v_link.revoked_at is not null or v_link.expires_at <= now()
     or v_link.uses >= v_link.max_uses then
    perform public.raise_error('invalid_join_link', 'El enlace ya no está disponible.');
  end if;
  if not exists (select 1 from public.branches where id = v_link.branch_id
                 and chain_id = v_link.chain_id and is_active) then
    perform public.raise_error('branch_inactive', 'La sucursal ya no está activa.');
  end if;
  if exists (select 1 from public.profiles where auth_user_id = v_auth.id or lower(email) = lower(v_auth.email)) then
    perform public.raise_error('profile_exists', 'Esta cuenta ya pertenece a una cadena.');
  end if;
  insert into public.profiles(chain_id, auth_user_id, email, full_name, role, branch_id)
  values (v_link.chain_id, v_auth.id, lower(v_auth.email), trim(p_full_name), 'operator', v_link.branch_id)
  returning * into v_profile;
  update public.branch_join_links set uses = uses + 1 where branch_id = v_link.branch_id;
  perform public.log_audit(v_profile.id, v_link.chain_id, 'profile.join_branch', 'profile', v_profile.id,
    null, to_jsonb(v_profile));
  return v_profile;
end; $$;

revoke execute on function public.get_branch_join_link(uuid), public.create_branch_join_link(uuid),
  public.revoke_branch_join_link(uuid), public.join_branch_with_link(uuid, text) from public, anon;
grant execute on function public.get_branch_join_link(uuid), public.create_branch_join_link(uuid),
  public.revoke_branch_join_link(uuid), public.join_branch_with_link(uuid, text) to authenticated;
