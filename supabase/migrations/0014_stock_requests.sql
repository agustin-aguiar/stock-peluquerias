-- Pedidos entre locales. Cada transición y el despacho se confirman en una sola transacción.
create table public.stock_requests (
  id uuid primary key,
  chain_id uuid not null references public.chains(id) on delete cascade,
  branch_id uuid not null references public.branches(id),
  product_id uuid not null references public.products(id),
  qty numeric(14,2) not null check (qty > 0),
  note text check (length(note) <= 500),
  status text not null default 'pending_admin' check (status in ('pending_admin','pending_source','rejected','declined','dispatched')),
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  source_branch_id uuid references public.branches(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_note text check (length(decision_note) <= 500),
  transfer_id uuid unique references public.transfers(id),
  check (source_branch_id is null or source_branch_id <> branch_id)
);
create index stock_requests_chain_status_idx on public.stock_requests(chain_id, status, requested_at desc);
create index stock_requests_branch_idx on public.stock_requests(branch_id, requested_at desc);
create index stock_requests_source_idx on public.stock_requests(source_branch_id, status);
alter table public.stock_requests enable row level security;
create policy stock_requests_select on public.stock_requests for select to authenticated
  using (chain_id = public.current_chain_id() and
    (public.is_admin() or branch_id = public.current_branch_id() or source_branch_id = public.current_branch_id()));
revoke all on public.stock_requests from anon, authenticated;
grant select on public.stock_requests to authenticated;

create function public.request_stock(p_id uuid, p_product_id uuid, p_qty numeric, p_note text default null)
returns public.stock_requests language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_product public.products; v_row public.stock_requests;
  v_note text := nullif(trim(p_note), '');
begin
  v_actor := public.assert_active();
  if v_actor.role <> 'operator' then perform public.raise_error('permission_denied', 'Solo un local puede pedir stock.'); end if;
  if p_id is null then perform public.raise_error('invalid_key', 'Falta el identificador del pedido.'); end if;
  if length(coalesce(v_note, '')) > 500 then perform public.raise_error('invalid_text', 'La nota es demasiado larga.'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_actor.chain_id::text || ':request:' || p_id::text, 0));
  select * into v_row from public.stock_requests where id = p_id;
  if v_row.id is not null then
    if v_row.chain_id = v_actor.chain_id and v_row.requested_by = v_actor.id
       and v_row.product_id = p_product_id and v_row.qty = p_qty
       and v_row.note is not distinct from v_note then return v_row; end if;
    perform public.raise_error('idempotency_conflict', 'Este pedido ya existe con otros datos.');
  end if;
  select * into v_product from public.products where id = p_product_id and chain_id = v_actor.chain_id and is_active;
  if v_product.id is null then perform public.raise_error('not_found', 'El producto no existe o está inactivo.'); end if;
  perform public.assert_quantity_scale(p_qty, v_product.unit);
  if p_qty <= 0 or p_qty > v_product.max_movement_qty then
    perform public.raise_error('invalid_quantity', 'La cantidad no es válida para este producto.'); end if;
  if not exists (select 1 from public.branches where id = v_actor.branch_id and chain_id = v_actor.chain_id and is_active) then
    perform public.raise_error('branch_inactive', 'Tu local no está activo.'); end if;
  if not exists (select 1 from public.inventory where branch_id = v_actor.branch_id
      and product_id = p_product_id and initialized_at is not null) then
    perform public.raise_error('not_initialized', 'El producto necesita una primera carga en tu local antes de recibir un traslado.'); end if;
  insert into public.stock_requests(id, chain_id, branch_id, product_id, qty, note, requested_by)
  values (p_id, v_actor.chain_id, v_actor.branch_id, p_product_id, p_qty, v_note, v_actor.id) returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'stock_request.create', 'stock_request', v_row.id, null, to_jsonb(v_row));
  return v_row;
end; $$;

create function public.review_stock_request(p_request_id uuid, p_source_branch_id uuid default null, p_reason text default null)
returns public.stock_requests language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_row public.stock_requests; v_old public.stock_requests;
  v_reason text := nullif(trim(p_reason), '');
begin
  v_actor := public.assert_admin();
  if length(coalesce(v_reason, '')) > 500 then perform public.raise_error('invalid_text', 'El motivo es demasiado largo.'); end if;
  select * into v_row from public.stock_requests where id = p_request_id and chain_id = v_actor.chain_id for update;
  if v_row.id is null then perform public.raise_error('not_found', 'El pedido no existe.'); end if;
  if v_row.status <> 'pending_admin' then perform public.raise_error('invalid_request_state', 'El pedido ya fue revisado.'); end if;
  if p_source_branch_id is null and v_reason is null then perform public.raise_error('reason_required', 'Explicá por qué se rechaza.'); end if;
  if p_source_branch_id is not null then
    if p_source_branch_id = v_row.branch_id then perform public.raise_error('invalid_transfer', 'Elegí otro local.'); end if;
    if not exists (select 1 from public.branches where id = p_source_branch_id and chain_id = v_actor.chain_id and is_active) then
      perform public.raise_error('branch_inactive', 'El local de origen no está activo.'); end if;
    if not exists (select 1 from public.inventory where branch_id = p_source_branch_id and product_id = v_row.product_id
      and initialized_at is not null and balance >= v_row.qty) then
      perform public.raise_error('insufficient_stock', 'El local elegido no tiene suficiente stock disponible.'); end if;
  end if;
  v_old := v_row;
  update public.stock_requests set status = case when p_source_branch_id is null then 'rejected' else 'pending_source' end,
    source_branch_id = p_source_branch_id, reviewed_by = v_actor.id, reviewed_at = now(), decision_note = v_reason
    where id = v_row.id returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id,
    case when p_source_branch_id is null then 'stock_request.reject' else 'stock_request.forward' end,
    'stock_request', v_row.id, to_jsonb(v_old), to_jsonb(v_row));
  return v_row;
end; $$;

create function public.decide_stock_request(p_request_id uuid, p_accept boolean, p_reason text default null)
returns public.stock_requests language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_row public.stock_requests; v_old public.stock_requests;
  v_origin public.inventory; v_op public.operations; v_transfer public.transfers;
  v_product public.products; v_reason text := nullif(trim(p_reason), ''); v_key uuid;
begin
  v_actor := public.assert_active();
  if v_actor.role <> 'operator' then perform public.raise_error('permission_denied', 'Solo el local elegido puede responder.'); end if;
  if p_accept is null then perform public.raise_error('invalid_request_state', 'Elegí aceptar o rechazar.'); end if;
  if length(coalesce(v_reason, '')) > 500 then perform public.raise_error('invalid_text', 'El motivo es demasiado largo.'); end if;
  if not p_accept and v_reason is null then perform public.raise_error('reason_required', 'Explicá por qué no se puede enviar.'); end if;
  select * into v_row from public.stock_requests where id = p_request_id and chain_id = v_actor.chain_id for update;
  if v_row.id is null then perform public.raise_error('not_found', 'El pedido no existe.'); end if;
  if v_row.source_branch_id <> v_actor.branch_id then perform public.raise_error('permission_denied', 'Este pedido corresponde a otro local.'); end if;
  if v_row.status <> 'pending_source' then perform public.raise_error('invalid_request_state', 'Este pedido ya fue respondido.'); end if;
  v_old := v_row;
  if not p_accept then
    update public.stock_requests set status = 'declined', decided_by = v_actor.id, decided_at = now(), decision_note = v_reason
      where id = v_row.id returning * into v_row;
    perform public.log_audit(v_actor.id, v_actor.chain_id, 'stock_request.decline', 'stock_request', v_row.id, to_jsonb(v_old), to_jsonb(v_row));
    return v_row;
  end if;
  select * into v_product from public.products where id = v_row.product_id and chain_id = v_actor.chain_id and is_active;
  if v_product.id is null then perform public.raise_error('product_inactive', 'El producto ya no está activo.'); end if;
  if (select count(*) from public.branches where id in (v_row.branch_id, v_row.source_branch_id) and is_active) <> 2 then
    perform public.raise_error('branch_inactive', 'Alguno de los locales está inactivo.'); end if;
  if not exists (select 1 from public.inventory where branch_id = v_row.branch_id and product_id = v_row.product_id and initialized_at is not null) then
    perform public.raise_error('not_initialized', 'El destino todavía no tiene una primera carga.'); end if;
  select * into v_origin from public.inventory where branch_id = v_row.source_branch_id and product_id = v_row.product_id for update;
  if v_origin.id is null or v_origin.initialized_at is null or v_origin.balance < v_row.qty then
    perform public.raise_error('insufficient_stock', 'Ya no hay suficiente stock para enviar esa cantidad.'); end if;
  v_key := gen_random_uuid();
  insert into public.transfers(id, chain_id, product_id, from_branch_id, to_branch_id, qty, shipping_ref, created_by,
    status, dispatched_by, dispatched_at)
  values (v_key, v_actor.chain_id, v_row.product_id, v_row.source_branch_id, v_row.branch_id, v_row.qty,
    'Pedido de stock', v_actor.id, 'dispatched', v_actor.id, now()) returning * into v_transfer;
  insert into public.operations(chain_id, type, actor_profile_id, idempotency_key, request_hash, reference)
  values (v_actor.chain_id, 'dispatch', v_actor.id, gen_random_uuid(),
    md5(jsonb_build_object('type','stock_request_dispatch','request',v_row.id)::text), 'Pedido de stock') returning * into v_op;
  insert into public.movements(chain_id, operation_id, product_id, branch_id, transfer_id, qty_delta, unit)
  values (v_actor.chain_id, v_op.id, v_row.product_id, v_row.source_branch_id, v_transfer.id, -v_row.qty, v_product.unit),
    (v_actor.chain_id, v_op.id, v_row.product_id, null, v_transfer.id, v_row.qty, v_product.unit);
  update public.inventory set balance = balance - v_row.qty, version = version + 1, updated_at = now() where id = v_origin.id;
  perform public.recalc_alert(v_row.source_branch_id, v_row.product_id);
  update public.operations set result = jsonb_build_object('operation_id',v_op.id,'transfer_id',v_transfer.id,'status','dispatched') where id = v_op.id;
  update public.stock_requests set status = 'dispatched', decided_by = v_actor.id, decided_at = now(),
    decision_note = v_reason, transfer_id = v_transfer.id where id = v_row.id returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'stock_request.dispatch', 'stock_request', v_row.id, to_jsonb(v_old), to_jsonb(v_row));
  return v_row;
end; $$;

revoke execute on function public.request_stock(uuid,uuid,numeric,text),
  public.review_stock_request(uuid,uuid,text), public.decide_stock_request(uuid,boolean,text) from public, anon;
grant execute on function public.request_stock(uuid,uuid,numeric,text),
  public.review_stock_request(uuid,uuid,text), public.decide_stock_request(uuid,boolean,text) to authenticated;
