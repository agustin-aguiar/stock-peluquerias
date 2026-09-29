-- La reserva corre con permisos del servicio, también para las claves secretas nuevas.
-- Solo service_role conserva EXECUTE y acceso a la tabla privada.
create or replace function public.claim_daily_low_stock_email(
  p_chain_id uuid, p_local_date date, p_recipient_email text)
returns boolean language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into public.daily_low_stock_emails
    (chain_id, local_date, recipient_email, attempts, locked_until)
  values (p_chain_id, p_local_date, lower(trim(p_recipient_email)), 1, now() + interval '10 minutes')
  on conflict (chain_id, local_date, recipient_email) do update
    set attempts = public.daily_low_stock_emails.attempts + 1,
        locked_until = excluded.locked_until,
        last_error = null
  where public.daily_low_stock_emails.sent_at is null
    and (public.daily_low_stock_emails.locked_until is null
      or public.daily_low_stock_emails.locked_until < now())
  returning id into v_id;

  return v_id is not null;
end;
$$;

revoke execute on function public.claim_daily_low_stock_email(uuid, date, text)
  from public, anon, authenticated;
grant execute on function public.claim_daily_low_stock_email(uuid, date, text)
  to service_role;
