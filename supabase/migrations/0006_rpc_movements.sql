-- SP2: movimientos operativos. Cada RPC escribe operación, movimiento, saldo y alerta
-- en una sola transacción. La clave de idempotencia se bloquea antes del inventario.

create or replace function public.register_movement(
  p_key uuid, p_type public.operation_type, p_branch_id uuid, p_product_id uuid,
  p_qty numeric, p_reason text default null, p_reference text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor public.profiles; v_prod public.products; v_branch public.branches;
  v_inv public.inventory; v_old public.inventory; v_existing public.operations;
  v_op public.operations; v_mov_id uuid; v_hash text; v_delta numeric(14,2);
  v_reason text := nullif(trim(p_reason), '');
  v_reference text := nullif(trim(p_reference), '');
  v_result jsonb;
begin
  v_actor := public.assert_active();
  if p_key is null then perform public.raise_error('invalid_key', 'Falta el identificador de la operación.'); end if;
  if p_type is null or p_type not in ('purchase', 'consumption', 'sale', 'shrinkage', 'adjustment') then
    perform public.raise_error('invalid_type', 'Tipo de movimiento no permitido.');
  end if;
  if p_type in ('purchase', 'adjustment') and v_actor.role <> 'admin' then
    perform public.raise_error('permission_denied', 'Esta acción requiere perfil de administrador.');
  end if;
  if v_actor.role = 'operator' and p_branch_id is distinct from v_actor.branch_id then
    perform public.raise_error('permission_denied', 'Solo podés operar en tu sucursal.');
  end if;
  if length(coalesce(v_reason, '')) > 500 or length(coalesce(v_reference, '')) > 120 then
    perform public.raise_error('invalid_text', 'El motivo o la referencia supera el máximo permitido.');
  end if;
  if p_type in ('shrinkage', 'adjustment') and v_reason is null then
    perform public.raise_error('reason_required', 'Ingresá un motivo.');
  end if;

  v_hash := md5(jsonb_build_object('type', p_type, 'branch', p_branch_id,
    'product', p_product_id, 'qty', p_qty, 'reason', v_reason, 'reference', v_reference)::text);
  perform pg_advisory_xact_lock(hashtextextended(v_actor.chain_id::text || ':' || p_key::text, 0));
  select * into v_existing from public.operations
   where chain_id = v_actor.chain_id and idempotency_key = p_key;
  if v_existing.id is not null then
    if v_existing.request_hash = v_hash and v_existing.actor_profile_id = v_actor.id
       and v_existing.type = p_type then
      return v_existing.result;
    end if;
    perform public.raise_error('idempotency_conflict', 'Esta clave ya se usó con otros datos.');
  end if;

  select * into v_prod from public.products where id = p_product_id and chain_id = v_actor.chain_id;
  if v_prod.id is null then perform public.raise_error('not_found', 'El producto no existe.'); end if;
  if not v_prod.is_active then perform public.raise_error('product_inactive', 'El producto está inactivo.'); end if;
  select * into v_branch from public.branches where id = p_branch_id and chain_id = v_actor.chain_id;
  if v_branch.id is null then perform public.raise_error('not_found', 'La sucursal no existe.'); end if;
  if not v_branch.is_active then perform public.raise_error('branch_inactive', 'La sucursal está inactiva.'); end if;
  perform public.assert_quantity_scale(abs(p_qty), v_prod.unit);
  if p_qty = 0 or abs(p_qty) > v_prod.max_movement_qty then
    perform public.raise_error('invalid_quantity', 'La cantidad debe ser mayor que cero y no superar el máximo del producto.');
  end if;
  v_delta := case when p_type in ('consumption', 'sale', 'shrinkage') then -p_qty else p_qty end;
  if p_type <> 'adjustment' and p_qty < 0 then
    perform public.raise_error('invalid_quantity', 'La cantidad debe ser positiva.');
  end if;

  select * into v_inv from public.inventory
   where branch_id = p_branch_id and product_id = p_product_id and chain_id = v_actor.chain_id for update;
  if v_inv.id is null then perform public.raise_error('not_enabled', 'El producto no está habilitado en esta sucursal.'); end if;
  if v_inv.initialized_at is null then
    perform public.raise_error('not_initialized', 'Registrá el saldo inicial antes de operar.');
  end if;
  if v_inv.balance + v_delta < 0 then
    perform public.raise_error('insufficient_stock', 'La salida supera el saldo disponible.');
  end if;
  v_old := v_inv;
  insert into public.operations (chain_id, type, actor_profile_id, idempotency_key, request_hash, reason, reference)
  values (v_actor.chain_id, p_type, v_actor.id, p_key, v_hash, v_reason, v_reference)
  returning * into v_op;
  insert into public.movements (chain_id, operation_id, product_id, branch_id, qty_delta, unit)
  values (v_actor.chain_id, v_op.id, p_product_id, p_branch_id, v_delta, v_prod.unit)
  returning id into v_mov_id;
  update public.inventory set balance = balance + v_delta, version = version + 1, updated_at = now()
   where id = v_inv.id returning * into v_inv;
  perform public.recalc_alert(p_branch_id, p_product_id);
  v_result := jsonb_build_object('operation_id', v_op.id, 'movement_id', v_mov_id,
    'balance', v_inv.balance, 'branch_id', p_branch_id, 'product_id', p_product_id);
  update public.operations set result = v_result where id = v_op.id;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'inventory.' || p_type::text,
    'inventory', v_inv.id, to_jsonb(v_old), to_jsonb(v_inv));
  return v_result;
end;
$$;

create or replace function public.reverse_movement(p_key uuid, p_movement_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor public.profiles; v_original public.movements; v_original_op public.operations;
  v_inv public.inventory; v_old public.inventory; v_existing public.operations;
  v_op public.operations; v_mov_id uuid; v_hash text;
  v_reason text := nullif(trim(p_reason), ''); v_result jsonb;
begin
  v_actor := public.assert_admin();
  if p_key is null then perform public.raise_error('invalid_key', 'Falta el identificador de la operación.'); end if;
  if v_reason is null then perform public.raise_error('reason_required', 'Ingresá un motivo.'); end if;
  if length(v_reason) > 500 then perform public.raise_error('invalid_text', 'El motivo supera el máximo permitido.'); end if;
  v_hash := md5(jsonb_build_object('type', 'reversal', 'movement', p_movement_id, 'reason', v_reason)::text);
  perform pg_advisory_xact_lock(hashtextextended(v_actor.chain_id::text || ':' || p_key::text, 0));
  select * into v_existing from public.operations
   where chain_id = v_actor.chain_id and idempotency_key = p_key;
  if v_existing.id is not null then
    if v_existing.request_hash = v_hash and v_existing.actor_profile_id = v_actor.id
       and v_existing.type = 'reversal' then
      return v_existing.result;
    end if;
    perform public.raise_error('idempotency_conflict', 'Esta clave ya se usó con otros datos.');
  end if;

  select * into v_original from public.movements
   where id = p_movement_id and chain_id = v_actor.chain_id for update;
  if v_original.id is null then perform public.raise_error('not_found', 'El movimiento no existe.'); end if;
  select * into v_original_op from public.operations where id = v_original.operation_id;
  if v_original.transfer_id is not null or v_original.reverses_movement_id is not null
     or v_original_op.type not in ('purchase', 'consumption', 'sale', 'shrinkage', 'adjustment') then
    perform public.raise_error('not_reversible', 'Este movimiento no admite reversión.');
  end if;
  if exists (select 1 from public.movements where reverses_movement_id = v_original.id) then
    perform public.raise_error('already_reversed', 'El movimiento ya fue revertido.');
  end if;
  select * into v_inv from public.inventory
   where branch_id = v_original.branch_id and product_id = v_original.product_id
     and chain_id = v_actor.chain_id for update;
  if v_inv.id is null then perform public.raise_error('not_enabled', 'El producto no está habilitado.'); end if;
  if not exists (select 1 from public.branches where id = v_inv.branch_id and is_active) then
    perform public.raise_error('branch_inactive', 'La sucursal está inactiva.');
  end if;
  if v_inv.balance - v_original.qty_delta < 0 then
    perform public.raise_error('insufficient_stock', 'La reversión dejaría saldo negativo.');
  end if;
  v_old := v_inv;
  insert into public.operations (chain_id, type, actor_profile_id, idempotency_key, request_hash, reason, reference)
  values (v_actor.chain_id, 'reversal', v_actor.id, p_key, v_hash, v_reason, v_original_op.id::text)
  returning * into v_op;
  insert into public.movements (chain_id, operation_id, product_id, branch_id, qty_delta, unit, reverses_movement_id)
  values (v_actor.chain_id, v_op.id, v_original.product_id, v_original.branch_id,
    -v_original.qty_delta, v_original.unit, v_original.id) returning id into v_mov_id;
  update public.inventory set balance = balance - v_original.qty_delta,
    version = version + 1, updated_at = now() where id = v_inv.id returning * into v_inv;
  perform public.recalc_alert(v_inv.branch_id, v_inv.product_id);
  v_result := jsonb_build_object('operation_id', v_op.id, 'movement_id', v_mov_id,
    'balance', v_inv.balance, 'branch_id', v_inv.branch_id, 'product_id', v_inv.product_id);
  update public.operations set result = v_result where id = v_op.id;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'inventory.reversal', 'inventory',
    v_inv.id, to_jsonb(v_old), to_jsonb(v_inv));
  return v_result;
end;
$$;

revoke execute on function
  public.register_movement(uuid, public.operation_type, uuid, uuid, numeric, text, text),
  public.reverse_movement(uuid, uuid, text)
from public, anon;
grant execute on function
  public.register_movement(uuid, public.operation_type, uuid, uuid, numeric, text, text),
  public.reverse_movement(uuid, uuid, text)
to authenticated;
