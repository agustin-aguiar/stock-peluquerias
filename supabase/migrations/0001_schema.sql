-- 0001_schema.sql — esquema P0 completo (SP1). Escrituras solo por RPC (ver 0002/0003/0004).

create type public.user_role as enum ('admin', 'operator');
create type public.unit_kind as enum ('unit', 'ml', 'g');
create type public.operation_type as enum (
  'initial', 'purchase', 'consumption', 'sale', 'shrinkage',
  'adjustment', 'reversal', 'dispatch', 'receipt', 'resolution'
);
create type public.transfer_status as enum (
  'draft', 'dispatched', 'received', 'disputed', 'resolved', 'cancelled'
);
create type public.alert_status as enum ('open', 'resolved');

create table public.chains (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  timezone text not null default 'America/Montevideo',
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9]{2,8}$'),
  name text not null check (length(trim(name)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (chain_id, code)
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  email text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  role public.user_role not null,
  branch_id uuid references public.branches (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profiles_role_branch check (
    (role = 'operator' and branch_id is not null) or (role = 'admin' and branch_id is null)
  )
);
create unique index profiles_chain_email_key on public.profiles (chain_id, lower(email));
create index profiles_branch_idx on public.profiles (branch_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  sku text not null check (sku ~ '^[A-Za-z0-9._-]{1,40}$'),
  name text not null check (length(trim(name)) between 1 and 160),
  brand text,
  category text,
  variant text,
  unit public.unit_kind not null,
  presentation text,
  presentation_qty numeric(14,2) check (presentation_qty is null or presentation_qty > 0),
  max_movement_qty numeric(14,2) not null default 100000 check (max_movement_qty > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index products_chain_sku_key on public.products (chain_id, lower(sku));
create index products_chain_name_idx on public.products (chain_id, name);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  branch_id uuid not null references public.branches (id),
  product_id uuid not null references public.products (id),
  balance numeric(14,2) not null default 0 check (balance >= 0),
  min_qty numeric(14,2) not null default 0 check (min_qty >= 0),
  version bigint not null default 1,
  initialized_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (branch_id, product_id)
);
create index inventory_chain_branch_idx on public.inventory (chain_id, branch_id);
create index inventory_product_idx on public.inventory (product_id);

create table public.operations (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  type public.operation_type not null,
  actor_profile_id uuid not null references public.profiles (id),
  idempotency_key uuid not null,
  request_hash text not null,
  reason text,
  reference text,
  result jsonb,
  created_at timestamptz not null default now(),
  unique (chain_id, idempotency_key)
);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  product_id uuid not null references public.products (id),
  from_branch_id uuid not null references public.branches (id),
  to_branch_id uuid not null references public.branches (id),
  qty numeric(14,2) not null check (qty > 0),
  status public.transfer_status not null default 'draft',
  shipping_ref text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  dispatched_by uuid references public.profiles (id),
  dispatched_at timestamptz,
  received_by uuid references public.profiles (id),
  received_at timestamptz,
  dispute_note text,
  disputed_by uuid references public.profiles (id),
  disputed_at timestamptz,
  resolved_qty_received numeric(14,2) check (resolved_qty_received is null or resolved_qty_received >= 0),
  resolved_qty_returned numeric(14,2) check (resolved_qty_returned is null or resolved_qty_returned >= 0),
  resolved_qty_lost numeric(14,2) check (resolved_qty_lost is null or resolved_qty_lost >= 0),
  resolution_note text,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  constraint transfers_distinct_branches check (from_branch_id <> to_branch_id)
);
create index transfers_chain_status_idx on public.transfers (chain_id, status);
create index transfers_from_idx on public.transfers (from_branch_id);
create index transfers_to_idx on public.transfers (to_branch_id);

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  operation_id uuid not null references public.operations (id),
  product_id uuid not null references public.products (id),
  branch_id uuid references public.branches (id),
  transfer_id uuid references public.transfers (id),
  qty_delta numeric(14,2) not null check (qty_delta <> 0),
  unit public.unit_kind not null,
  reverses_movement_id uuid unique references public.movements (id),
  created_at timestamptz not null default now(),
  -- branch_id null = ubicación lógica "tránsito", que exige transfer_id
  constraint movements_location check (branch_id is not null or transfer_id is not null)
);
create index movements_chain_product_idx on public.movements (chain_id, product_id, created_at desc);
create index movements_branch_idx on public.movements (branch_id, created_at desc);
create index movements_transfer_idx on public.movements (transfer_id) where transfer_id is not null;
create index movements_operation_idx on public.movements (operation_id);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  branch_id uuid not null references public.branches (id),
  product_id uuid not null references public.products (id),
  status public.alert_status not null default 'open',
  opened_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index alerts_one_open_idx on public.alerts (branch_id, product_id) where status = 'open';
create index alerts_chain_status_idx on public.alerts (chain_id, status);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  actor_profile_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_chain_created_idx on public.audit_events (chain_id, created_at desc);

-- Vincula una cuenta Auth recién creada con el perfil pre-registrado por email.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
     set auth_user_id = new.id
   where id = (
     select p.id from public.profiles p
      where p.auth_user_id is null and lower(p.email) = lower(new.email)
      order by p.created_at
      limit 1
   );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
