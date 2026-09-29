-- SP4: indicadores por período y conteo físico con aprobación por versión.

create table public.physical_counts (
  id uuid primary key,
  chain_id uuid not null references public.chains(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  product_id uuid not null references public.products(id),
  observed_qty numeric(14,2) not null check (observed_qty >= 0),
  base_balance numeric(14,2) not null,
  base_version bigint not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text,
  submitted_by uuid not null references public.profiles(id),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  operation_id uuid references public.operations(id)
);
create index physical_counts_chain_status_idx on public.physical_counts(chain_id, status, submitted_at desc);
alter table public.physical_counts enable row level security;
revoke all on public.physical_counts from anon, authenticated;
grant select on public.physical_counts to authenticated;
create policy physical_counts_select on public.physical_counts for select to authenticated
  using (chain_id = public.current_chain_id() and (public.is_admin() or branch_id = public.current_branch_id()));

create or replace function public.submit_physical_count(
  p_id uuid, p_branch_id uuid, p_product_id uuid, p_observed_qty numeric, p_note text default null)
returns public.physical_counts language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_prod public.products; v_inv public.inventory;
  v_existing public.physical_counts; v_row public.physical_counts; v_note text := nullif(trim(p_note), '');
begin
  v_actor := public.assert_active();
  if p_id is null then perform public.raise_error('invalid_key', 'Falta el identificador del conteo.'); end if;
  if v_actor.role = 'operator' and v_actor.branch_id is distinct from p_branch_id then
    perform public.raise_error('permission_denied', 'Solo podés contar tu sucursal.');
  end if;
  if length(coalesce(v_note, '')) > 500 then perform public.raise_error('invalid_text', 'La nota es demasiado larga.'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_actor.chain_id::text || ':count:' || p_id::text, 0));
  select * into v_existing from public.physical_counts where id = p_id;
  if v_existing.id is not null then
    if v_existing.chain_id = v_actor.chain_id and v_existing.submitted_by = v_actor.id
      and v_existing.branch_id = p_branch_id and v_existing.product_id = p_product_id
      and v_existing.observed_qty = p_observed_qty and v_existing.note is not distinct from v_note then return v_existing; end if;
    perform public.raise_error('idempotency_conflict', 'El conteo ya se envió con otros datos.');
  end if;
  select * into v_prod from public.products where id = p_product_id and chain_id = v_actor.chain_id and is_active;
  if v_prod.id is null then perform public.raise_error('not_found', 'El producto no existe o está inactivo.'); end if;
  if not exists (select 1 from public.branches where id = p_branch_id and chain_id = v_actor.chain_id and is_active) then
    perform public.raise_error('branch_inactive', 'La sucursal no está activa.');
  end if;
  perform public.assert_quantity_scale(p_observed_qty, v_prod.unit);
  select * into v_inv from public.inventory where branch_id = p_branch_id and product_id = p_product_id
    and chain_id = v_actor.chain_id for update;
  if v_inv.id is null or v_inv.initialized_at is null then perform public.raise_error('not_initialized', 'El inventario no está inicializado.'); end if;
  insert into public.physical_counts (id, chain_id, branch_id, product_id, observed_qty,
    base_balance, base_version, note, submitted_by)
  values (p_id, v_actor.chain_id, p_branch_id, p_product_id, p_observed_qty,
    v_inv.balance, v_inv.version, v_note, v_actor.id) returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'count.submit', 'physical_count', v_row.id, null, to_jsonb(v_row));
  return v_row;
end;
$$;

create or replace function public.approve_physical_count(p_count_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_count public.physical_counts; v_inv public.inventory;
  v_old public.inventory; v_prod public.products; v_delta numeric; v_op public.operations;
  v_result jsonb;
begin
  v_actor := public.assert_admin();
  select * into v_count from public.physical_counts where id = p_count_id and chain_id = v_actor.chain_id for update;
  if v_count.id is null then perform public.raise_error('not_found', 'El conteo no existe.'); end if;
  if v_count.status = 'approved' then
    select result into v_result from public.operations where id = v_count.operation_id;
    return v_result;
  end if;
  if v_count.status <> 'pending' then perform public.raise_error('invalid_count_state', 'El conteo ya fue rechazado.'); end if;
  select * into v_inv from public.inventory where branch_id = v_count.branch_id and product_id = v_count.product_id for update;
  if v_inv.id is null then perform public.raise_error('not_enabled', 'El inventario ya no existe.'); end if;
  if v_inv.version <> v_count.base_version or v_inv.balance <> v_count.base_balance then
    perform public.raise_error('stale_count', 'El saldo cambió; repetí el conteo.');
  end if;
  select * into v_prod from public.products where id = v_count.product_id;
  v_delta := v_count.observed_qty - v_inv.balance;
  if abs(v_delta) > v_prod.max_movement_qty then
    perform public.raise_error('invalid_quantity', 'La diferencia supera el máximo por movimiento.');
  end if;
  v_old := v_inv;
  insert into public.operations (chain_id, type, actor_profile_id, idempotency_key, request_hash, reason, reference)
  values (v_actor.chain_id, 'adjustment', v_actor.id, v_count.id,
    md5(jsonb_build_object('count', v_count.id, 'delta', v_delta)::text),
    coalesce(v_count.note, 'Conteo físico aprobado'), v_count.id::text) returning * into v_op;
  if v_delta <> 0 then
    insert into public.movements (chain_id, operation_id, product_id, branch_id, qty_delta, unit)
    values (v_actor.chain_id, v_op.id, v_count.product_id, v_count.branch_id, v_delta, v_prod.unit);
    update public.inventory set balance = v_count.observed_qty, version = version + 1,
      updated_at = now() where id = v_inv.id returning * into v_inv;
    perform public.recalc_alert(v_count.branch_id, v_count.product_id);
  end if;
  update public.physical_counts set status = 'approved', reviewed_by = v_actor.id,
    reviewed_at = now(), operation_id = v_op.id where id = v_count.id;
  v_result := jsonb_build_object('operation_id', v_op.id, 'count_id', v_count.id,
    'balance', v_inv.balance, 'delta', v_delta);
  update public.operations set result = v_result where id = v_op.id;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'count.approve', 'physical_count', v_count.id, to_jsonb(v_old), v_result);
  return v_result;
end;
$$;

create or replace function public.reject_physical_count(p_count_id uuid, p_reason text)
returns public.physical_counts language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_row public.physical_counts; v_old public.physical_counts;
  v_reason text := nullif(trim(p_reason), '');
begin
  v_actor := public.assert_admin();
  if v_reason is null then perform public.raise_error('reason_required', 'Explicá el rechazo.'); end if;
  if length(v_reason) > 500 then perform public.raise_error('invalid_text', 'La explicación es demasiado larga.'); end if;
  select * into v_row from public.physical_counts where id = p_count_id and chain_id = v_actor.chain_id for update;
  if v_row.id is null then perform public.raise_error('not_found', 'El conteo no existe.'); end if;
  if v_row.status <> 'pending' then perform public.raise_error('invalid_count_state', 'El conteo ya fue revisado.'); end if;
  v_old := v_row;
  update public.physical_counts set status = 'rejected', reviewed_by = v_actor.id,
    reviewed_at = now(), note = concat_ws(' · ', v_row.note, 'Rechazo: ' || v_reason)
    where id = v_row.id returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'count.reject', 'physical_count', v_row.id, to_jsonb(v_old), to_jsonb(v_row));
  return v_row;
end;
$$;

create or replace function public.dashboard_snapshot(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_result jsonb;
begin
  v_actor := public.assert_admin();
  if p_from is null or p_to is null or p_from >= p_to or p_to - p_from > interval '366 days' then
    perform public.raise_error('invalid_period', 'Elegí un período válido de hasta un año.');
  end if;
  select jsonb_build_object(
    'branches', coalesce((select jsonb_agg(to_jsonb(x) order by x.branch_name) from (
      select b.id as branch_id, b.name as branch_name,
        count(i.id) filter (where p.is_active and i.balance <= i.min_qty) as below_min,
        count(i.id) filter (where p.is_active and i.balance = 0) as zero_balance,
        (select count(*) from public.transfers t where t.chain_id = v_actor.chain_id
          and t.status in ('draft', 'dispatched', 'disputed')
          and (t.from_branch_id = b.id or t.to_branch_id = b.id)) as open_transfers
      from public.branches b left join public.inventory i on i.branch_id = b.id
        left join public.products p on p.id = i.product_id
      where b.chain_id = v_actor.chain_id and b.is_active
      group by b.id, b.name
    ) x), '[]'::jsonb),
    'usage', coalesce((select jsonb_agg(to_jsonb(y) order by y.product_name, y.branch_name) from (
      select m.product_id, p.name as product_name, p.sku, p.unit,
        m.branch_id, b.name as branch_name,
        sum(-m.qty_delta) filter (where o.type = 'consumption') as consumption,
        sum(-m.qty_delta) filter (where o.type = 'shrinkage') as shrinkage
      from public.movements m join public.operations o on o.id = m.operation_id
        join public.products p on p.id = m.product_id
        join public.branches b on b.id = m.branch_id
      where m.chain_id = v_actor.chain_id and m.created_at >= p_from and m.created_at < p_to
        and o.type in ('consumption', 'shrinkage')
        and not exists (select 1 from public.movements reversal where reversal.reverses_movement_id = m.id)
      group by m.product_id, p.name, p.sku, p.unit, m.branch_id, b.name
    ) y), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.list_physical_counts(p_status text default 'pending')
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_result jsonb;
begin
  v_actor := public.assert_active();
  if p_status not in ('pending', 'approved', 'rejected', 'all') then
    perform public.raise_error('invalid_count_state', 'Estado de conteo inválido.');
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.submitted_at desc), '[]'::jsonb) into v_result
    from (select c.*, p.name as product_name, p.sku, p.unit, b.name as branch_name
      from public.physical_counts c join public.products p on p.id = c.product_id
        join public.branches b on b.id = c.branch_id
      where c.chain_id = v_actor.chain_id
        and (v_actor.role = 'admin' or c.branch_id = v_actor.branch_id)
        and (p_status = 'all' or c.status = p_status)
      order by c.submitted_at desc limit 200) x;
  return v_result;
end;
$$;

revoke execute on function public.submit_physical_count(uuid, uuid, uuid, numeric, text),
  public.approve_physical_count(uuid), public.reject_physical_count(uuid, text),
  public.dashboard_snapshot(timestamptz, timestamptz), public.list_physical_counts(text) from public, anon;
grant execute on function public.submit_physical_count(uuid, uuid, uuid, numeric, text),
  public.approve_physical_count(uuid), public.reject_physical_count(uuid, text),
  public.dashboard_snapshot(timestamptz, timestamptz), public.list_physical_counts(text) to authenticated;
