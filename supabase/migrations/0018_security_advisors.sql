-- Correcciones de los avisos de seguridad de Supabase.
-- La función del trigger de Auth no debe poder llamarse como RPC.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

-- Fijar search_path en funciones auxiliares que no lo tenían.
alter function public.raise_error(text, text) set search_path = public, pg_temp;
alter function public.assert_quantity_scale(numeric, public.unit_kind) set search_path = public, pg_temp;
alter function public.log_audit(uuid, uuid, text, text, uuid, jsonb, jsonb) set search_path = public, pg_temp;
