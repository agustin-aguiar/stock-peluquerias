-- 0002_helpers_rls.sql — helpers de sesión, vistas y RLS de solo lectura.

-- Helpers: devuelven null si no hay sesión, no hay perfil o el perfil está inactivo.
create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select p.id from public.profiles p
   where p.auth_user_id = auth.uid() and p.is_active
   limit 1;
$$;

create or replace function public.current_chain_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select p.chain_id from public.profiles p
   where p.auth_user_id = auth.uid() and p.is_active
   limit 1;
$$;

create or replace function public.current_branch_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select p.branch_id from public.profiles p
   where p.auth_user_id = auth.uid() and p.is_active
   limit 1;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select p.role = 'admin' from public.profiles p
     where p.auth_user_id = auth.uid() and p.is_active
     limit 1
  ), false);
$$;

revoke execute on function public.current_profile_id(), public.current_chain_id(),
  public.current_branch_id(), public.is_admin() from public, anon;
grant execute on function public.current_profile_id(), public.current_chain_id(),
  public.current_branch_id(), public.is_admin() to authenticated;

-- Vistas
-- profiles_public: única vista privilegiada (se ejecuta como su dueño). Expone solo nombre y rol de la propia cadena.
create view public.profiles_public
with (security_invoker = false) as
  select p.id, p.chain_id, p.full_name, p.role, p.branch_id
    from public.profiles p
   where p.chain_id = public.current_chain_id();

-- inventory_status: vista de lectura con RLS de las tablas subyacentes (security_invoker).
create view public.inventory_status
with (security_invoker = true) as
  select i.id, i.chain_id, i.branch_id, i.product_id, i.balance, i.min_qty, i.version,
         i.initialized_at, i.updated_at,
         (i.balance <= i.min_qty) as below_min,
         p.sku, p.name as product_name, p.unit, p.is_active as product_active, p.brand, p.category,
         b.code as branch_code, b.name as branch_name, b.is_active as branch_active
    from public.inventory i
    join public.products p on p.id = i.product_id
    join public.branches b on b.id = i.branch_id;

-- RLS: habilitada (sin FORCE, para que las RPC SECURITY DEFINER y el seed escriban). Solo SELECT.
alter table public.chains enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.operations enable row level security;
alter table public.transfers enable row level security;
alter table public.movements enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_events enable row level security;

create policy chains_select on public.chains for select to authenticated
  using (id = public.current_chain_id());

create policy branches_select on public.branches for select to authenticated
  using (chain_id = public.current_chain_id());

create policy products_select on public.products for select to authenticated
  using (chain_id = public.current_chain_id());

create policy profiles_select on public.profiles for select to authenticated
  using (chain_id = public.current_chain_id()
         and (public.is_admin() or id = public.current_profile_id()));

create policy inventory_select on public.inventory for select to authenticated
  using (chain_id = public.current_chain_id()
         and (public.is_admin() or branch_id = public.current_branch_id()));

create policy movements_select on public.movements for select to authenticated
  using (chain_id = public.current_chain_id()
         and (public.is_admin() or branch_id = public.current_branch_id()));

create policy operations_select on public.operations for select to authenticated
  using (chain_id = public.current_chain_id()
         and (public.is_admin() or exists (
           select 1 from public.movements m
            where m.operation_id = operations.id and m.branch_id = public.current_branch_id())));

create policy alerts_select on public.alerts for select to authenticated
  using (chain_id = public.current_chain_id()
         and (public.is_admin() or branch_id = public.current_branch_id()));

create policy transfers_select on public.transfers for select to authenticated
  using (chain_id = public.current_chain_id()
         and (public.is_admin()
              or from_branch_id = public.current_branch_id()
              or to_branch_id = public.current_branch_id()));

create policy audit_events_select on public.audit_events for select to authenticated
  using (chain_id = public.current_chain_id() and public.is_admin());

-- Privilegios: anon nada; authenticated solo SELECT (las escrituras van por RPC).
revoke all on all tables in schema public from anon, authenticated;
grant select on public.chains, public.branches, public.profiles, public.products,
  public.inventory, public.operations, public.transfers, public.movements,
  public.alerts, public.audit_events, public.profiles_public, public.inventory_status
  to authenticated;
