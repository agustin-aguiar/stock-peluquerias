-- seed.sql — cadena demo reproducible. Idempotente: borra y recrea "Cadena Demo".
-- Las cuentas Auth se crean a mano (docs/operacion.md); al final se re-vinculan por email.

delete from public.chains where name = 'Cadena Demo';

insert into public.chains (id, name, timezone)
values ('11111111-1111-4111-8111-111111111111', 'Cadena Demo', 'America/Montevideo');

insert into public.branches (id, chain_id, code, name) values
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111111', 'CEN', 'Sucursal Centro'),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111111', 'POC', 'Sucursal Pocitos');

insert into public.profiles (id, chain_id, email, full_name, role, branch_id) values
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111111', 'admin@example.com',   'Valeria Méndez', 'admin',    null),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111111', 'centro@example.com',  'Sofía Varela',   'operator', '22222222-2222-4222-8222-222222222201'),
  ('33333333-3333-4333-8333-333333333303', '11111111-1111-4111-8111-111111111111', 'pocitos@example.com', 'Esteban Rossi',  'operator', '22222222-2222-4222-8222-222222222202');

-- Re-vincular cuentas Auth existentes (tras un re-seed los perfiles se recrean).
update public.profiles p
   set auth_user_id = u.id
  from auth.users u
 where p.chain_id = '11111111-1111-4111-8111-111111111111'
   and p.auth_user_id is null
   and lower(u.email) = lower(p.email)
   and not exists (select 1 from public.profiles q where q.auth_user_id = u.id);
