-- SP4: lotes CSV atómicos y repetibles. El navegador sólo envía filas ya previsualizadas;
-- la RPC vuelve a validar cada fila y cualquier error revierte el lote entero.

create table public.import_batches (
  id uuid primary key,
  chain_id uuid not null references public.chains(id) on delete cascade,
  kind text not null check (kind in ('catalog', 'initial')),
  content_hash text not null,
  rows jsonb not null,
  result jsonb,
  actor_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(chain_id, kind, content_hash)
);
alter table public.import_batches enable row level security;
revoke all on public.import_batches from anon, authenticated;
grant select on public.import_batches to authenticated;
create policy import_batches_select on public.import_batches for select to authenticated
  using (chain_id = public.current_chain_id() and public.is_admin());

create or replace function public.import_csv_batch(p_id uuid, p_kind text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor public.profiles; v_hash text; v_existing public.import_batches;
  v_row jsonb; v_sku text; v_name text; v_unit public.unit_kind;
  v_branch_id uuid; v_product public.products; v_qty numeric; v_min numeric;
  v_created integer := 0; v_result jsonb; v_idx integer := 0;
begin
  v_actor := public.assert_admin();
  if p_id is null then perform public.raise_error('invalid_key', 'Falta la clave del lote.'); end if;
  if p_kind not in ('catalog', 'initial') or p_kind is null then
    perform public.raise_error('invalid_import', 'Tipo de importación inválido.');
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 500 then
    perform public.raise_error('invalid_import', 'El archivo debe tener entre 1 y 500 filas.');
  end if;
  v_hash := md5(p_rows::text);
  perform pg_advisory_xact_lock(hashtextextended(v_actor.chain_id::text || ':import', 0));
  select * into v_existing from public.import_batches where id = p_id;
  if v_existing.id is not null then
    if v_existing.chain_id = v_actor.chain_id and v_existing.kind = p_kind
       and v_existing.content_hash = v_hash and v_existing.actor_profile_id = v_actor.id then
      return v_existing.result;
    end if;
    perform public.raise_error('idempotency_conflict', 'El lote ya se usó con otros datos.');
  end if;
  if exists (select 1 from public.import_batches where chain_id = v_actor.chain_id
      and kind = p_kind and content_hash = v_hash) then
    perform public.raise_error('duplicate_import', 'Este contenido ya se importó.');
  end if;

  -- La fila del lote se escribe antes de los cambios y se confirma con ellos.
  insert into public.import_batches(id, chain_id, kind, content_hash, rows, actor_profile_id)
  values (p_id, v_actor.chain_id, p_kind, v_hash, p_rows, v_actor.id);
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_idx := v_idx + 1;
    if jsonb_typeof(v_row) <> 'object' then perform public.raise_error('invalid_import', 'Cada fila debe ser un objeto.'); end if;
    if p_kind = 'catalog' then
      v_sku := trim(v_row->>'sku'); v_name := trim(v_row->>'name');
      if v_row->>'unit' not in ('unit', 'ml', 'g') then
        perform public.raise_error('invalid_unit', 'Unidad inválida en el catálogo.');
      end if;
      v_unit := (v_row->>'unit')::public.unit_kind;
      perform public.upsert_product(p_sku => v_sku, p_name => v_name, p_unit => v_unit,
        p_brand => nullif(trim(v_row->>'brand'), ''),
        p_category => nullif(trim(v_row->>'category'), ''),
        p_presentation => nullif(trim(v_row->>'presentation'), ''),
        p_presentation_qty => nullif(v_row->>'presentation_qty', '')::numeric);
    else
      select id into v_branch_id from public.branches where chain_id = v_actor.chain_id
        and code = upper(trim(v_row->>'branch_code')) and is_active;
      if v_branch_id is null then perform public.raise_error('branch_inactive', 'Sucursal desconocida o inactiva.'); end if;
      select * into v_product from public.products where chain_id = v_actor.chain_id
        and lower(sku) = lower(trim(v_row->>'sku')) and is_active;
      if v_product.id is null then perform public.raise_error('not_found', 'SKU desconocido o inactivo.'); end if;
      v_qty := nullif(v_row->>'qty', '')::numeric;
      v_min := coalesce(nullif(v_row->>'min_qty', '')::numeric, 0);
      perform public.assert_quantity_scale(v_qty, v_product.unit);
      perform public.assert_quantity_scale(v_min, v_product.unit);
      if not exists (select 1 from public.inventory where branch_id = v_branch_id and product_id = v_product.id) then
        perform public.enable_product_in_branch(v_product.id, v_branch_id, v_min);
      elsif (select min_qty from public.inventory where branch_id = v_branch_id and product_id = v_product.id) <> v_min then
        perform public.raise_error('invalid_import', 'El mínimo difiere del configurado.');
      end if;
      perform public.set_initial_balance(gen_random_uuid(), v_branch_id, v_product.id, v_qty, 'Importación ' || p_id::text);
    end if;
    v_created := v_created + 1;
  end loop;
  v_result := jsonb_build_object('batch_id', p_id, 'kind', p_kind, 'rows', v_created);
  update public.import_batches set result = v_result where id = p_id;
  perform public.log_audit(v_actor.id, v_actor.chain_id, 'import.' || p_kind, 'import_batch', p_id, null, v_result);
  return v_result;
end;
$$;
revoke execute on function public.import_csv_batch(uuid, text, jsonb) from public, anon;
grant execute on function public.import_csv_batch(uuid, text, jsonb) to authenticated;
