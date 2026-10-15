-- Alta autoservicio: cada correo confirmado puede crear una sola cadena propia.
-- Nunca se aceptan rol, chain_id ni auth_user_id enviados por el navegador.
-- El modelo actual vincula una cuenta Auth con un solo perfil, por lo que el
-- mismo correo no puede ser invitado a dos cadenas distintas.
create unique index profiles_email_global_key on public.profiles (lower(email));

create function public.create_my_chain(p_chain_name text, p_full_name text)
returns public.profiles language plpgsql security definer set search_path = public, pg_temp as $$
declare v_auth auth.users; v_chain public.chains; v_profile public.profiles;
begin
  if auth.uid() is null then perform public.raise_error('permission_denied', 'Iniciá sesión para crear tu cadena.'); end if;
  select * into v_auth from auth.users where id = auth.uid() for update;
  if v_auth.id is null or v_auth.email_confirmed_at is null or v_auth.email is null then
    perform public.raise_error('email_unconfirmed', 'Confirmá tu correo antes de crear tu cadena.');
  end if;
  if p_chain_name is null or length(trim(p_chain_name)) not between 1 and 120
     or p_full_name is null or length(trim(p_full_name)) not between 1 and 120 then
    perform public.raise_error('invalid_name', 'Ingresá el nombre de la cadena y tu nombre (hasta 120 caracteres).');
  end if;
  if exists (select 1 from public.profiles where auth_user_id = v_auth.id or lower(email) = lower(v_auth.email)) then
    perform public.raise_error('profile_exists', 'Esta cuenta ya pertenece a una cadena.');
  end if;
  insert into public.chains(name) values (trim(p_chain_name)) returning * into v_chain;
  insert into public.profiles(chain_id, auth_user_id, email, full_name, role, branch_id)
    values (v_chain.id, v_auth.id, lower(v_auth.email), trim(p_full_name), 'admin', null)
    returning * into v_profile;
  perform public.log_audit(v_profile.id, v_chain.id, 'chain.create', 'chain', v_chain.id, null, to_jsonb(v_chain));
  return v_profile;
end; $$;

revoke execute on function public.create_my_chain(text, text) from public, anon;
grant execute on function public.create_my_chain(text, text) to authenticated;

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
  if exists (select 1 from public.profiles where lower(email) = lower(trim(p_email))) then
    perform public.raise_error('duplicate_email', 'Este correo ya pertenece a una cadena.');
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

