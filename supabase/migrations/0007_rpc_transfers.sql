-- SP3: transferencias de un SKU. Tránsito es una ubicación lógica (branch_id null).

create or replace function public.create_transfer(
  p_id uuid, p_product_id uuid, p_from_branch_id uuid, p_to_branch_id uuid,
  p_qty numeric, p_shipping_ref text default null)
returns public.transfers language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_product public.products; v_existing public.transfers;
  v_row public.transfers; v_ref text := nullif(trim(p_shipping_ref), '');
begin
  v_actor := public.assert_admin();
  if p_id is null then perform public.raise_error('invalid_key', 'Falta el identificador de la transferencia.'); end if;
  if p_from_branch_id is null or p_to_branch_id is null or p_from_branch_id = p_to_branch_id then
    perform public.raise_error('invalid_transfer', 'Elegí dos sucursales diferentes.');
  end if;
  if length(coalesce(v_ref, '')) > 120 then perform public.raise_error('invalid_text', 'La referencia es demasiado larga.'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_actor.chain_id::text || ':transfer:' || p_id::text, 0));
  select * into v_existing from public.transfers where id = p_id;
  if v_existing.id is not null then
    if v_existing.chain_id = v_actor.chain_id and v_existing.product_id = p_product_id
       and v_existing.from_branch_id = p_from_branch_id and v_existing.to_branch_id = p_to_branch_id
       and v_existing.qty = p_qty and v_existing.shipping_ref is not distinct from v_ref then
      return v_existing;
    end if;
    perform public.raise_error('idempotency_conflict', 'La transferencia ya existe con otros datos.');
  end if;
  select * into v_product from public.products where id = p_product_id and chain_id = v_actor.chain_id;
  if v_product.id is null then perform public.raise_error('not_found', 'El producto no existe.'); end if;
  if not v_product.is_active then perform public.raise_error('product_inactive', 'El producto está inactivo.'); end if;
  perform public.assert_quantity_scale(p_qty, v_product.unit);
  if p_qty = 0 or p_qty > v_product.max_movement_qty then
    perform public.raise_error('invalid_quantity', 'La cantidad es inválida para este producto.');
  end if;
  if (select count(*) from public.branches where id in (p_from_branch_id, p_to_branch_id)
      and chain_id = v_actor.chain_id and is_active) <> 2 then
    perform public.raise_error('branch_inactive', 'Origen y destino deben ser sucursales activas de la cadena.');
  end if;
  if (select count(*) from public.inventory where branch_id in (p_from_branch_id, p_to_branch_id)
      and product_id = p_product_id and chain_id = v_actor.chain_id and initialized_at is not null) <> 2 then
    perform public.raise_error('not_enabled', 'El producto debe estar habilitado e inicializado en ambos locales.');
  end if;
  insert into public.transfers (id, chain_id, product_id, from_branch_id, to_branch_id,
    qty, shipping_ref, created_by) values (p_id, v_actor.chain_id, p_product_id,
    p_from_branch_id, p_to_branch_id, p_qty, v_ref, v_actor.id) returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'transfer.create', 'transfer', v_row.id, null, to_jsonb(v_row));
  return v_row;
end;
$$;

create or replace function public.cancel_transfer(p_transfer_id uuid)
returns public.transfers language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_row public.transfers; v_old public.transfers;
begin
  v_actor := public.assert_admin();
  select * into v_row from public.transfers where id = p_transfer_id and chain_id = v_actor.chain_id for update;
  if v_row.id is null then perform public.raise_error('not_found', 'La transferencia no existe.'); end if;
  if v_row.status = 'cancelled' then return v_row; end if;
  if v_row.status <> 'draft' then perform public.raise_error('invalid_transfer_state', 'Solo se cancela un borrador.'); end if;
  v_old := v_row;
  update public.transfers set status = 'cancelled' where id = v_row.id returning * into v_row;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'transfer.cancel', 'transfer', v_row.id, to_jsonb(v_old), to_jsonb(v_row));
  return v_row;
end;
$$;

create or replace function public.dispatch_transfer(p_key uuid, p_transfer_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_t public.transfers; v_inv public.inventory;
  v_old public.inventory; v_op public.operations; v_existing public.operations;
  v_hash text; v_result jsonb;
begin
  v_actor := public.assert_admin();
  if p_key is null then perform public.raise_error('invalid_key', 'Falta la clave de la operación.'); end if;
  v_hash := md5(jsonb_build_object('type', 'dispatch', 'transfer', p_transfer_id)::text);
  perform pg_advisory_xact_lock(hashtextextended(v_actor.chain_id::text || ':' || p_key::text, 0));
  select * into v_existing from public.operations where chain_id = v_actor.chain_id and idempotency_key = p_key;
  if v_existing.id is not null then
    if v_existing.type = 'dispatch' and v_existing.actor_profile_id = v_actor.id and v_existing.request_hash = v_hash then return v_existing.result; end if;
    perform public.raise_error('idempotency_conflict', 'La clave ya se usó con otros datos.');
  end if;
  select * into v_t from public.transfers where id = p_transfer_id and chain_id = v_actor.chain_id for update;
  if v_t.id is null then perform public.raise_error('not_found', 'La transferencia no existe.'); end if;
  if v_t.status <> 'draft' then perform public.raise_error('invalid_transfer_state', 'La transferencia ya no es un borrador.'); end if;
  if (select count(*) from public.branches where id in (v_t.from_branch_id, v_t.to_branch_id) and is_active) <> 2
     or not exists (select 1 from public.products where id = v_t.product_id and is_active) then
    perform public.raise_error('branch_inactive', 'El producto y ambas sucursales deben seguir activos.');
  end if;
  select * into v_inv from public.inventory where branch_id = v_t.from_branch_id and product_id = v_t.product_id for update;
  if v_inv.id is null or v_inv.initialized_at is null then perform public.raise_error('not_enabled', 'El origen no está habilitado.'); end if;
  if v_inv.balance < v_t.qty then perform public.raise_error('insufficient_stock', 'El origen no tiene saldo suficiente.'); end if;
  v_old := v_inv;
  insert into public.operations (chain_id, type, actor_profile_id, idempotency_key, request_hash, reference)
  values (v_actor.chain_id, 'dispatch', v_actor.id, p_key, v_hash, v_t.shipping_ref) returning * into v_op;
  insert into public.movements (chain_id, operation_id, product_id, branch_id, transfer_id, qty_delta, unit)
  select v_actor.chain_id, v_op.id, v_t.product_id, v_t.from_branch_id, v_t.id, -v_t.qty, p.unit
    from public.products p where p.id = v_t.product_id;
  insert into public.movements (chain_id, operation_id, product_id, branch_id, transfer_id, qty_delta, unit)
  select v_actor.chain_id, v_op.id, v_t.product_id, null, v_t.id, v_t.qty, p.unit
    from public.products p where p.id = v_t.product_id;
  update public.inventory set balance = balance - v_t.qty, version = version + 1, updated_at = now()
    where id = v_inv.id returning * into v_inv;
  update public.transfers set status = 'dispatched', dispatched_by = v_actor.id, dispatched_at = now() where id = v_t.id;
  perform public.recalc_alert(v_t.from_branch_id, v_t.product_id);
  v_result := jsonb_build_object('operation_id', v_op.id, 'transfer_id', v_t.id,
    'status', 'dispatched', 'origin_balance', v_inv.balance, 'transit_qty', v_t.qty);
  update public.operations set result = v_result where id = v_op.id;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'transfer.dispatch', 'transfer', v_t.id, to_jsonb(v_old), v_result);
  return v_result;
end;
$$;

create or replace function public.receive_transfer(p_key uuid, p_transfer_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_t public.transfers; v_inv public.inventory;
  v_old public.inventory; v_op public.operations; v_existing public.operations;
  v_hash text; v_result jsonb;
begin
  v_actor := public.assert_active();
  if p_key is null then perform public.raise_error('invalid_key', 'Falta la clave de la operación.'); end if;
  v_hash := md5(jsonb_build_object('type', 'receipt', 'transfer', p_transfer_id)::text);
  perform pg_advisory_xact_lock(hashtextextended(v_actor.chain_id::text || ':' || p_key::text, 0));
  select * into v_existing from public.operations where chain_id = v_actor.chain_id and idempotency_key = p_key;
  if v_existing.id is not null then
    if v_existing.type = 'receipt' and v_existing.actor_profile_id = v_actor.id and v_existing.request_hash = v_hash then return v_existing.result; end if;
    perform public.raise_error('idempotency_conflict', 'La clave ya se usó con otros datos.');
  end if;
  select * into v_t from public.transfers where id = p_transfer_id and chain_id = v_actor.chain_id for update;
  if v_t.id is null then perform public.raise_error('not_found', 'La transferencia no existe.'); end if;
  if v_actor.role = 'operator' and v_actor.branch_id <> v_t.to_branch_id then
    perform public.raise_error('permission_denied', 'Solo el destino puede recibir.');
  end if;
  if v_t.status <> 'dispatched' then perform public.raise_error('invalid_transfer_state', 'La transferencia no está pendiente de recepción.'); end if;
  select * into v_inv from public.inventory where branch_id = v_t.to_branch_id and product_id = v_t.product_id for update;
  if v_inv.id is null or v_inv.initialized_at is null then perform public.raise_error('not_enabled', 'El destino no está habilitado.'); end if;
  v_old := v_inv;
  insert into public.operations (chain_id, type, actor_profile_id, idempotency_key, request_hash)
  values (v_actor.chain_id, 'receipt', v_actor.id, p_key, v_hash) returning * into v_op;
  insert into public.movements (chain_id, operation_id, product_id, branch_id, transfer_id, qty_delta, unit)
  select v_actor.chain_id, v_op.id, v_t.product_id, null, v_t.id, -v_t.qty, p.unit
    from public.products p where p.id = v_t.product_id;
  insert into public.movements (chain_id, operation_id, product_id, branch_id, transfer_id, qty_delta, unit)
  select v_actor.chain_id, v_op.id, v_t.product_id, v_t.to_branch_id, v_t.id, v_t.qty, p.unit
    from public.products p where p.id = v_t.product_id;
  update public.inventory set balance = balance + v_t.qty, version = version + 1, updated_at = now()
    where id = v_inv.id returning * into v_inv;
  update public.transfers set status = 'received', received_by = v_actor.id, received_at = now() where id = v_t.id;
  perform public.recalc_alert(v_t.to_branch_id, v_t.product_id);
  v_result := jsonb_build_object('operation_id', v_op.id, 'transfer_id', v_t.id,
    'status', 'received', 'destination_balance', v_inv.balance, 'transit_qty', 0);
  update public.operations set result = v_result where id = v_op.id;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'transfer.receive', 'transfer', v_t.id, to_jsonb(v_old), v_result);
  return v_result;
end;
$$;

create or replace function public.report_transfer_difference(p_transfer_id uuid, p_note text)
returns public.transfers language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_t public.transfers; v_old public.transfers; v_note text := nullif(trim(p_note), '');
begin
  v_actor := public.assert_active();
  if v_note is null then perform public.raise_error('reason_required', 'Describí la diferencia.'); end if;
  if length(v_note) > 500 then perform public.raise_error('invalid_text', 'La descripción es demasiado larga.'); end if;
  select * into v_t from public.transfers where id = p_transfer_id and chain_id = v_actor.chain_id for update;
  if v_t.id is null then perform public.raise_error('not_found', 'La transferencia no existe.'); end if;
  if v_actor.role = 'operator' and v_actor.branch_id <> v_t.to_branch_id then
    perform public.raise_error('permission_denied', 'Solo el destino puede reportar diferencias.');
  end if;
  if v_t.status = 'disputed' and v_t.dispute_note = v_note then return v_t; end if;
  if v_t.status <> 'dispatched' then perform public.raise_error('invalid_transfer_state', 'La transferencia ya no admite diferencias.'); end if;
  v_old := v_t;
  update public.transfers set status = 'disputed', dispute_note = v_note,
    disputed_by = v_actor.id, disputed_at = now() where id = v_t.id returning * into v_t;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'transfer.dispute', 'transfer', v_t.id, to_jsonb(v_old), to_jsonb(v_t));
  return v_t;
end;
$$;

create or replace function public.resolve_transfer(
  p_key uuid, p_transfer_id uuid, p_qty_received numeric, p_qty_returned numeric,
  p_qty_lost numeric, p_note text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_t public.transfers; v_prod public.products;
  v_origin public.inventory; v_dest public.inventory; v_lock public.inventory;
  v_op public.operations; v_existing public.operations; v_hash text; v_result jsonb;
  v_note text := nullif(trim(p_note), '');
begin
  v_actor := public.assert_admin();
  if p_key is null then perform public.raise_error('invalid_key', 'Falta la clave de la operación.'); end if;
  if v_note is null then perform public.raise_error('reason_required', 'Explicá la resolución.'); end if;
  if length(v_note) > 500 then perform public.raise_error('invalid_text', 'La explicación es demasiado larga.'); end if;
  v_hash := md5(jsonb_build_object('type', 'resolution', 'transfer', p_transfer_id,
    'received', p_qty_received, 'returned', p_qty_returned, 'lost', p_qty_lost, 'note', v_note)::text);
  perform pg_advisory_xact_lock(hashtextextended(v_actor.chain_id::text || ':' || p_key::text, 0));
  select * into v_existing from public.operations where chain_id = v_actor.chain_id and idempotency_key = p_key;
  if v_existing.id is not null then
    if v_existing.type = 'resolution' and v_existing.actor_profile_id = v_actor.id and v_existing.request_hash = v_hash then return v_existing.result; end if;
    perform public.raise_error('idempotency_conflict', 'La clave ya se usó con otros datos.');
  end if;
  select * into v_t from public.transfers where id = p_transfer_id and chain_id = v_actor.chain_id for update;
  if v_t.id is null then perform public.raise_error('not_found', 'La transferencia no existe.'); end if;
  if v_t.status <> 'disputed' then perform public.raise_error('invalid_transfer_state', 'Solo se resuelve una diferencia reportada.'); end if;
  select * into v_prod from public.products where id = v_t.product_id;
  perform public.assert_quantity_scale(p_qty_received, v_prod.unit);
  perform public.assert_quantity_scale(p_qty_returned, v_prod.unit);
  perform public.assert_quantity_scale(p_qty_lost, v_prod.unit);
  if p_qty_received + p_qty_returned + p_qty_lost <> v_t.qty then
    perform public.raise_error('transfer_mismatch', 'Recibido, devuelto y merma deben sumar lo despachado.');
  end if;
  if (select count(*) from public.branches where id in (v_t.from_branch_id, v_t.to_branch_id) and is_active) <> 2 then
    perform public.raise_error('branch_inactive', 'Ambas sucursales deben seguir activas.');
  end if;
  -- Orden estable para transferencias que cierran en sentidos opuestos.
  for v_lock in select * from public.inventory where product_id = v_t.product_id
      and branch_id in (v_t.from_branch_id, v_t.to_branch_id) order by id for update loop
    if v_lock.branch_id = v_t.from_branch_id then v_origin := v_lock; else v_dest := v_lock; end if;
  end loop;
  if v_origin.id is null or v_dest.id is null then perform public.raise_error('not_enabled', 'Falta inventario en origen o destino.'); end if;
  insert into public.operations (chain_id, type, actor_profile_id, idempotency_key, request_hash, reason)
  values (v_actor.chain_id, 'resolution', v_actor.id, p_key, v_hash, v_note) returning * into v_op;
  insert into public.movements (chain_id, operation_id, product_id, branch_id, transfer_id, qty_delta, unit)
  values (v_actor.chain_id, v_op.id, v_t.product_id, null, v_t.id, -v_t.qty, v_prod.unit);
  if p_qty_received > 0 then
    insert into public.movements (chain_id, operation_id, product_id, branch_id, transfer_id, qty_delta, unit)
    values (v_actor.chain_id, v_op.id, v_t.product_id, v_t.to_branch_id, v_t.id, p_qty_received, v_prod.unit);
    update public.inventory set balance = balance + p_qty_received, version = version + 1,
      updated_at = now() where id = v_dest.id;
  end if;
  if p_qty_returned > 0 then
    insert into public.movements (chain_id, operation_id, product_id, branch_id, transfer_id, qty_delta, unit)
    values (v_actor.chain_id, v_op.id, v_t.product_id, v_t.from_branch_id, v_t.id, p_qty_returned, v_prod.unit);
    update public.inventory set balance = balance + p_qty_returned, version = version + 1,
      updated_at = now() where id = v_origin.id;
  end if;
  update public.transfers set status = 'resolved', resolved_qty_received = p_qty_received,
    resolved_qty_returned = p_qty_returned, resolved_qty_lost = p_qty_lost,
    resolution_note = v_note, resolved_by = v_actor.id, resolved_at = now() where id = v_t.id;
  perform public.recalc_alert(v_t.from_branch_id, v_t.product_id);
  perform public.recalc_alert(v_t.to_branch_id, v_t.product_id);
  v_result := jsonb_build_object('operation_id', v_op.id, 'transfer_id', v_t.id,
    'status', 'resolved', 'qty_received', p_qty_received, 'qty_returned', p_qty_returned,
    'qty_lost', p_qty_lost, 'transit_qty', 0);
  update public.operations set result = v_result where id = v_op.id;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'transfer.resolve', 'transfer', v_t.id, to_jsonb(v_t), v_result);
  return v_result;
end;
$$;

revoke execute on function public.create_transfer(uuid, uuid, uuid, uuid, numeric, text),
  public.cancel_transfer(uuid), public.dispatch_transfer(uuid, uuid),
  public.receive_transfer(uuid, uuid), public.report_transfer_difference(uuid, text),
  public.resolve_transfer(uuid, uuid, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.create_transfer(uuid, uuid, uuid, uuid, numeric, text),
  public.cancel_transfer(uuid), public.dispatch_transfer(uuid, uuid),
  public.receive_transfer(uuid, uuid), public.report_transfer_difference(uuid, text),
  public.resolve_transfer(uuid, uuid, numeric, numeric, numeric, text) to authenticated;
