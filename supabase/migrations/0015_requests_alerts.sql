-- Permite reasignar un pedido rechazado por el local elegido.
create or replace function public.review_stock_request(p_request_id uuid, p_source_branch_id uuid default null, p_reason text default null)
returns public.stock_requests language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_row public.stock_requests; v_old public.stock_requests;
  v_reason text := nullif(trim(p_reason), '');
begin
  v_actor := public.assert_admin();
  if length(coalesce(v_reason, '')) > 500 then perform public.raise_error('invalid_text', 'El motivo es demasiado largo.'); end if;
  select * into v_row from public.stock_requests where id = p_request_id and chain_id = v_actor.chain_id for update;
  if v_row.id is null then perform public.raise_error('not_found', 'El pedido no existe.'); end if;
  if v_row.status not in ('pending_admin', 'declined') then perform public.raise_error('invalid_request_state', 'El pedido ya fue revisado.'); end if;
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
    source_branch_id = p_source_branch_id, reviewed_by = v_actor.id, reviewed_at = now(),
    decided_by = null, decided_at = null, decision_note = v_reason
    where id = v_row.id returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id,
    case when p_source_branch_id is null then 'stock_request.reject' else 'stock_request.forward' end,
    'stock_request', v_row.id, to_jsonb(v_old), to_jsonb(v_row));
  return v_row;
end; $$;

-- Un producto habilitado pero sin primera carga no es un producto agotado.
create or replace view public.inventory_status with (security_invoker = true) as
  select i.id, i.chain_id, i.branch_id, i.product_id, i.balance, i.min_qty, i.version,
         i.initialized_at, i.updated_at,
         (i.initialized_at is not null and i.balance <= i.min_qty) as below_min,
         p.sku, p.name as product_name, p.unit, p.is_active as product_active, p.brand, p.category,
         b.code as branch_code, b.name as branch_name, b.is_active as branch_active
    from public.inventory i
    join public.products p on p.id = i.product_id
    join public.branches b on b.id = i.branch_id;

create or replace function public.recalc_alert(p_branch_id uuid, p_product_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_inv public.inventory; v_open uuid;
begin
  select * into v_inv from public.inventory where branch_id = p_branch_id and product_id = p_product_id;
  if v_inv.id is null then return; end if;
  select id into v_open from public.alerts
   where branch_id = p_branch_id and product_id = p_product_id and status = 'open';
  if v_inv.initialized_at is not null and v_inv.balance <= v_inv.min_qty then
    if v_open is null then
      insert into public.alerts (chain_id, branch_id, product_id) values (v_inv.chain_id, p_branch_id, p_product_id);
    end if;
  elsif v_open is not null then
    update public.alerts set status = 'resolved', resolved_at = now() where id = v_open;
  end if;
end; $$;

update public.alerts a set status = 'resolved', resolved_at = now()
  from public.inventory i where a.branch_id = i.branch_id and a.product_id = i.product_id
  and a.status = 'open' and i.initialized_at is null;

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
        count(i.id) filter (where p.is_active and i.initialized_at is not null and i.balance <= i.min_qty) as below_min,
        count(i.id) filter (where p.is_active and i.initialized_at is not null and i.balance = 0) as zero_balance,
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


create or replace function public.request_stock(p_id uuid, p_product_id uuid, p_qty numeric, p_note text default null)
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
  insert into public.stock_requests(id, chain_id, branch_id, product_id, qty, note, requested_by)
  values (p_id, v_actor.chain_id, v_actor.branch_id, p_product_id, p_qty, v_note, v_actor.id) returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'stock_request.create', 'stock_request', v_row.id, null, to_jsonb(v_row));
  return v_row;
end; $$;


create or replace function public.decide_stock_request(p_request_id uuid, p_accept boolean, p_reason text default null)
returns public.stock_requests language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_row public.stock_requests; v_old public.stock_requests;
  v_origin public.inventory; v_op public.operations; v_transfer public.transfers;
  v_product public.products; v_destination public.inventory;
  v_reason text := nullif(trim(p_reason), ''); v_key uuid;
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
  select * into v_origin from public.inventory where branch_id = v_row.source_branch_id and product_id = v_row.product_id for update;
  if v_origin.id is null or v_origin.initialized_at is null or v_origin.balance < v_row.qty then
    perform public.raise_error('insufficient_stock', 'Ya no hay suficiente stock para enviar esa cantidad.'); end if;
  -- El pedido puede ser del primer ingreso de este producto al destino. Se
  -- habilita con cero; el stock llega solo al confirmar la recepcion.
  select * into v_destination from public.inventory where branch_id = v_row.branch_id and product_id = v_row.product_id;
  if v_destination.id is null or v_destination.initialized_at is null then
    insert into public.inventory(chain_id, branch_id, product_id, initialized_at)
      values (v_actor.chain_id, v_row.branch_id, v_row.product_id, now())
      on conflict (branch_id, product_id) do update
        set initialized_at = coalesce(public.inventory.initialized_at, excluded.initialized_at)
      returning * into v_destination;
    perform public.recalc_alert(v_row.branch_id, v_row.product_id);
    perform public.log_audit(v_actor.id, v_actor.chain_id, 'inventory.initial_balance', 'inventory',
      v_destination.id, null, to_jsonb(v_destination));
  end if;
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

