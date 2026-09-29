-- Carga rápida desde Inventario: habilita el SKU si hace falta y registra
-- saldo inicial o ingreso en una sola transacción, con una sola clave de reintento.
create or replace function public.assign_stock(
  p_key uuid, p_branch_id uuid, p_product_id uuid, p_qty numeric, p_reference text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor public.profiles; v_product public.products; v_branch public.branches;
  v_inv public.inventory; v_old public.inventory; v_operation public.operations;
  v_existing public.operations; v_hash text; v_movement_id uuid; v_result jsonb;
  v_reference text := nullif(trim(p_reference), ''); v_initial boolean; v_inserted integer;
begin
  v_actor := public.assert_admin();
  if p_key is null then perform public.raise_error('invalid_key', 'Falta el identificador de la operación.'); end if;
  if length(coalesce(v_reference, '')) > 120 then
    perform public.raise_error('invalid_text', 'La referencia supera el máximo permitido.');
  end if;
  v_hash := md5(jsonb_build_object('type', 'assign_stock', 'branch', p_branch_id,
    'product', p_product_id, 'qty', p_qty, 'reference', v_reference)::text);

  perform pg_advisory_xact_lock(hashtextextended(v_actor.chain_id::text || ':' || p_key::text, 0));
  select * into v_existing from public.operations
   where chain_id = v_actor.chain_id and idempotency_key = p_key;
  if v_existing.id is not null then
    if v_existing.request_hash = v_hash and v_existing.actor_profile_id = v_actor.id
       and v_existing.result->>'source' = 'quick_assign' then
      return v_existing.result;
    end if;
    perform public.raise_error('idempotency_conflict', 'Esta clave ya se usó con otros datos.');
  end if;

  select * into v_product from public.products where id = p_product_id and chain_id = v_actor.chain_id;
  if v_product.id is null then perform public.raise_error('not_found', 'El producto no existe.'); end if;
  if not v_product.is_active then perform public.raise_error('product_inactive', 'El producto está inactivo.'); end if;
  select * into v_branch from public.branches where id = p_branch_id and chain_id = v_actor.chain_id;
  if v_branch.id is null then perform public.raise_error('not_found', 'La sucursal no existe.'); end if;
  if not v_branch.is_active then perform public.raise_error('branch_inactive', 'La sucursal está inactiva.'); end if;
  if p_qty is null or p_qty <= 0 then
    perform public.raise_error('invalid_quantity', 'La cantidad debe ser mayor que cero.');
  end if;
  perform public.assert_quantity_scale(p_qty, v_product.unit);
  if p_qty > v_product.max_movement_qty then
    perform public.raise_error('invalid_quantity', 'La cantidad supera el máximo por movimiento del producto.');
  end if;

  insert into public.inventory (chain_id, branch_id, product_id)
  values (v_actor.chain_id, p_branch_id, p_product_id)
  on conflict (branch_id, product_id) do nothing;
  get diagnostics v_inserted = row_count;
  select * into v_inv from public.inventory
   where branch_id = p_branch_id and product_id = p_product_id and chain_id = v_actor.chain_id for update;
  if v_inv.id is null then perform public.raise_error('not_enabled', 'No se pudo habilitar el producto.'); end if;
  v_old := v_inv;
  v_initial := v_inv.initialized_at is null;
  if v_initial and exists (select 1 from public.movements
       where branch_id = p_branch_id and product_id = p_product_id) then
    perform public.raise_error('already_initialized', 'El producto tiene movimientos previos.');
  end if;

  insert into public.operations (chain_id, type, actor_profile_id, idempotency_key, request_hash, reference)
  values (v_actor.chain_id, case when v_initial then 'initial' else 'purchase' end,
    v_actor.id, p_key, v_hash, v_reference)
  returning * into v_operation;
  insert into public.movements (chain_id, operation_id, product_id, branch_id, qty_delta, unit)
  values (v_actor.chain_id, v_operation.id, p_product_id, p_branch_id, p_qty, v_product.unit)
  returning id into v_movement_id;
  update public.inventory
     set balance = balance + p_qty,
         initialized_at = coalesce(initialized_at, now()),
         version = version + 1, updated_at = now()
   where id = v_inv.id returning * into v_inv;
  perform public.recalc_alert(p_branch_id, p_product_id);
  v_result := jsonb_build_object('source', 'quick_assign', 'operation_id', v_operation.id,
    'movement_id', v_movement_id, 'branch_id', p_branch_id, 'product_id', p_product_id,
    'balance', v_inv.balance, 'kind', case when v_initial then 'initial' else 'purchase' end);
  update public.operations set result = v_result where id = v_operation.id;
  if v_inserted = 1 then
    perform public.log_audit(v_actor.id, v_actor.chain_id, 'inventory.enable',
      'inventory', v_inv.id, null, to_jsonb(v_old));
  end if;
  perform public.log_audit(v_actor.id, v_actor.chain_id,
    case when v_initial then 'inventory.initial_balance' else 'inventory.purchase' end,
    'inventory', v_inv.id, to_jsonb(v_old), to_jsonb(v_inv));
  return v_result;
end;
$$;

revoke execute on function public.assign_stock(uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.assign_stock(uuid, uuid, uuid, numeric, text) to authenticated;
