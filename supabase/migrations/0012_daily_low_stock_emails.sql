-- Registro y reserva de los resúmenes diarios. Solo lo usa la función privada del servidor.
create table public.daily_low_stock_emails (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.chains (id) on delete cascade,
  local_date date not null,
  recipient_email text not null,
  attempts integer not null default 0,
  locked_until timestamptz,
  sent_at timestamptz,
  brevo_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  unique (chain_id, local_date, recipient_email)
);

create index daily_low_stock_emails_pending_idx
  on public.daily_low_stock_emails (locked_until) where sent_at is null;

alter table public.daily_low_stock_emails enable row level security;
revoke all on public.daily_low_stock_emails from anon, authenticated;
grant select, insert, update on public.daily_low_stock_emails to service_role;

-- Una sola ejecución por destinatario y fecha puede reservar el envío a la vez.
create or replace function public.claim_daily_low_stock_email(
  p_chain_id uuid, p_local_date date, p_recipient_email text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Solo el servicio puede reservar correos diarios.' using errcode = '42501';
  end if;

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
