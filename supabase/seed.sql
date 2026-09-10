-- seed.sql — cadena demo reproducible (50 SKU, 2 sucursales, 3 perfiles).
-- Idempotente: borra y recrea "Cadena Demo". Las cuentas Auth se crean a mano (docs/operacion.md)
-- y se re-vinculan por email al final.

delete from public.chains where name = 'Cadena Demo';

insert into public.chains (id, name, timezone)
values ('11111111-1111-4111-8111-111111111111', 'Cadena Demo', 'America/Montevideo');

insert into public.branches (id, chain_id, code, name) values
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111111', 'CEN', 'Sucursal Centro'),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111111', 'POC', 'Sucursal Pocitos');

insert into public.profiles (id, chain_id, email, full_name, role, branch_id) values
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111111', 'admin@pelu.com',   'Valeria Méndez', 'admin',    null),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111111', 'centro@pelu.com',  'Sofía Varela',   'operator', '22222222-2222-4222-8222-222222222201'),
  ('33333333-3333-4333-8333-333333333303', '11111111-1111-4111-8111-111111111111', 'pocitos@pelu.com', 'Esteban Rossi',  'operator', '22222222-2222-4222-8222-222222222202');

-- Catálogo + mínimos y saldos por sucursal (min_cen, bal_cen, min_poc, bal_poc) en unidad base.
create temp table seed_products (
  sku text, name text, brand text, category text, variant text, unit public.unit_kind,
  presentation text, presentation_qty numeric,
  min_cen numeric, bal_cen numeric, min_poc numeric, bal_poc numeric
);

insert into seed_products values
  -- Tinturas (unidad = tubo)
  ('TIN-1.0',  'Tintura 1.0 Negro',                    'Wella Koleston', 'Tinturas', '1.0',  'unit', 'Tubo 60 ml', null, 3, 8,  3, 5),
  ('TIN-3.0',  'Tintura 3.0 Castaño oscuro',           'Wella Koleston', 'Tinturas', '3.0',  'unit', 'Tubo 60 ml', null, 3, 6,  3, 4),
  ('TIN-4.0',  'Tintura 4.0 Castaño medio',            'Wella Koleston', 'Tinturas', '4.0',  'unit', 'Tubo 60 ml', null, 4, 9,  3, 6),
  ('TIN-5.0',  'Tintura 5.0 Castaño claro',            'Wella Koleston', 'Tinturas', '5.0',  'unit', 'Tubo 60 ml', null, 4, 10, 3, 7),
  ('TIN-6.0',  'Tintura 6.0 Rubio oscuro',             'Wella Koleston', 'Tinturas', '6.0',  'unit', 'Tubo 60 ml', null, 4, 12, 3, 8),
  ('TIN-7.0',  'Tintura 7.0 Rubio medio',              'Wella Koleston', 'Tinturas', '7.0',  'unit', 'Tubo 60 ml', null, 4, 11, 3, 3),
  ('TIN-8.0',  'Tintura 8.0 Rubio claro',              'Wella Koleston', 'Tinturas', '8.0',  'unit', 'Tubo 60 ml', null, 4, 7,  3, 6),
  ('TIN-9.0',  'Tintura 9.0 Rubio muy claro',          'Wella Koleston', 'Tinturas', '9.0',  'unit', 'Tubo 60 ml', null, 3, 5,  2, 4),
  ('TIN-6.1',  'Tintura 6.1 Rubio oscuro ceniza',      'Wella Koleston', 'Tinturas', '6.1',  'unit', 'Tubo 60 ml', null, 3, 6,  2, 2),
  ('TIN-7.3',  'Tintura 7.3 Rubio medio dorado',       'Wella Koleston', 'Tinturas', '7.3',  'unit', 'Tubo 60 ml', null, 3, 8,  2, 5),
  ('TIN-5.4',  'Tintura 5.4 Castaño claro cobrizo',    'Wella Koleston', 'Tinturas', '5.4',  'unit', 'Tubo 60 ml', null, 2, 4,  2, 3),
  ('TIN-8.81', 'Tintura 8.81 Rubio claro perla ceniza','Wella Koleston', 'Tinturas', '8.81', 'unit', 'Tubo 60 ml', null, 2, 3,  2, 1),
  -- Oxidantes (ml, envase 1.000 ml)
  ('OX-10', 'Oxidante 10 vol. 1 L', 'Wella Welloxon', 'Oxidantes', '10 vol', 'ml', 'Envase 1.000 ml', 1000, 500, 1200, 500, 900),
  ('OX-20', 'Oxidante 20 vol. 1 L', 'Wella Welloxon', 'Oxidantes', '20 vol', 'ml', 'Envase 1.000 ml', 1000, 500, 850,  500, 400),
  ('OX-30', 'Oxidante 30 vol. 1 L', 'Wella Welloxon', 'Oxidantes', '30 vol', 'ml', 'Envase 1.000 ml', 1000, 500, 1500, 500, 1100),
  ('OX-40', 'Oxidante 40 vol. 1 L', 'Wella Welloxon', 'Oxidantes', '40 vol', 'ml', 'Envase 1.000 ml', 1000, 300, 700,  300, 600),
  -- Profesional a granel (ml)
  ('SH-PRO-NEUTRO', 'Shampoo profesional neutro 1 L',        'L''Oréal Professionnel', 'Profesional', null, 'ml', 'Envase 1.000 ml', 1000, 1980, 2000, 1000, 3500),
  ('SH-PRO-COLOR',  'Shampoo profesional color 1 L',         'L''Oréal Professionnel', 'Profesional', null, 'ml', 'Envase 1.000 ml', 1000, 800,  2400, 800,  1600),
  ('SH-PRO-DETOX',  'Shampoo profesional detox 1 L',         'L''Oréal Professionnel', 'Profesional', null, 'ml', 'Envase 1.000 ml', 1000, 800,  1300, 800,  2000),
  ('AC-PRO-HIDRA',  'Acondicionador profesional hidratante 1 L', 'L''Oréal Professionnel', 'Profesional', null, 'ml', 'Envase 1.000 ml', 1000, 800, 1900, 800, 1200),
  ('MASK-PRO-REP',  'Máscara profesional reparadora 1 L',    'L''Oréal Professionnel', 'Profesional', null, 'ml', 'Envase 1.000 ml', 1000, 500,  1400, 500,  700),
  ('PLEX-1',        'Plex paso 1 protector 500 ml',          'Olaplex',               'Tratamientos', 'Paso 1', 'ml', 'Envase 500 ml', 500, 250, 750, 250, 400),
  ('PLEX-2',        'Plex paso 2 reparador 500 ml',          'Olaplex',               'Tratamientos', 'Paso 2', 'ml', 'Envase 500 ml', 500, 250, 900, 250, 350),
  -- Decolorantes (g)
  ('DEC-500',  'Polvo decolorante premium 500 g', 'Wella Blondor', 'Decolorantes', null,   'g', 'Bolsa 500 g', 500, 500, 1250, 500, 800),
  ('DEC-AZUL', 'Polvo decolorante azul 500 g',    'Wella Blondor', 'Decolorantes', 'Azul', 'g', 'Bolsa 500 g', 500, 300, 600,  300, 250),
  -- Ampollas y tonalizantes (unidad)
  ('AMP-PLEX-10', 'Ampolla plex 10 ml',            'Olaplex',     'Tratamientos', null,     'unit', 'Caja x10', null, 10, 24, 10, 8),
  ('AMP-KER',     'Ampolla keratina 12 ml',        'Kativa',      'Tratamientos', null,     'unit', 'Caja x12', null, 10, 30, 10, 14),
  ('AMP-VIT',     'Ampolla vitaminas 15 ml',       'Kativa',      'Tratamientos', null,     'unit', 'Caja x12', null, 6,  12, 6,  10),
  ('TON-VIOL',    'Tonalizante violeta 60 ml',     'Wella Color', 'Tonalizantes', 'Violeta','unit', 'Tubo 60 ml', null, 3, 5, 3, 4),
  ('TON-GRIS',    'Tonalizante gris 60 ml',        'Wella Color', 'Tonalizantes', 'Gris',   'unit', 'Tubo 60 ml', null, 2, 4, 2, 2),
  -- Descartables e insumos (unidad)
  ('GUA-M',       'Guantes nitrilo talle M (caja x100)', 'Sensitex', 'Insumos', 'M', 'unit', 'Caja x100', null, 2, 4, 2, 6),
  ('GUA-L',       'Guantes nitrilo talle L (caja x100)', 'Sensitex', 'Insumos', 'L', 'unit', 'Caja x100', null, 2, 3, 2, 3),
  ('ALU-ROLLO',   'Papel aluminio rollo 100 m',          'Salon Pro', 'Insumos', null, 'unit', 'Rollo', null, 2, 5, 2, 4),
  ('CAPA-DESC',   'Capa descartable (pack x50)',         'Salon Pro', 'Insumos', null, 'unit', 'Pack x50', null, 1, 3, 1, 2),
  ('TOALLA-DESC', 'Toalla descartable (pack x50)',       'Salon Pro', 'Insumos', null, 'unit', 'Pack x50', null, 2, 6, 2, 5),
  ('GORRO-MECH',  'Gorro de mechas',                     'Salon Pro', 'Insumos', null, 'unit', 'Unidad', null, 2, 6, 2, 4),
  ('ALG-500',     'Algodón 500 g',                       'Estrella',  'Insumos', null, 'unit', 'Paquete 500 g', null, 1, 3, 1, 2),
  -- Venta cerrada al público (unidad)
  ('VT-SH-250',      'Shampoo reparador post-color 250 ml',  'Kérastase', 'Venta', null, 'unit', 'Frasco 250 ml', null, 5, 10, 5, 2),
  ('VT-AC-250',      'Acondicionador reparador 250 ml',      'Kérastase', 'Venta', null, 'unit', 'Frasco 250 ml', null, 4, 8,  4, 6),
  ('VT-MASK-200',    'Máscara nutritiva 200 ml',             'Kérastase', 'Venta', null, 'unit', 'Pote 200 ml', null, 3, 6, 3, 5),
  ('VT-SERUM-50',    'Sérum de puntas 50 ml',                'Kérastase', 'Venta', null, 'unit', 'Frasco 50 ml', null, 3, 7, 3, 4),
  ('VT-ACEITE-100',  'Aceite de argán 100 ml',               'Moroccanoil', 'Venta', null, 'unit', 'Frasco 100 ml', null, 3, 5, 3, 3),
  ('VT-SPRAY-150',   'Spray protector térmico 150 ml',       'Moroccanoil', 'Venta', null, 'unit', 'Spray 150 ml', null, 3, 9, 3, 7),
  ('VT-SH-ANTICASPA','Shampoo anticaspa 300 ml',             'Kérastase', 'Venta', null, 'unit', 'Frasco 300 ml', null, 3, 4, 3, 5),
  ('VT-SH-RIZOS',    'Shampoo para rizos 300 ml',            'Kérastase', 'Venta', null, 'unit', 'Frasco 300 ml', null, 3, 6, 3, 2),
  ('VT-CREMA-RIZOS', 'Crema para rizos 200 ml',              'Kérastase', 'Venta', null, 'unit', 'Pote 200 ml', null, 3, 5, 3, 4),
  ('VT-LACA-300',    'Laca fijación fuerte 300 ml',          'Schwarzkopf', 'Venta', null, 'unit', 'Aerosol 300 ml', null, 4, 12, 4, 9),
  ('VT-CERA-80',     'Cera modeladora 80 g',                 'Schwarzkopf', 'Venta', null, 'unit', 'Pote 80 g', null, 3, 7, 3, 6),
  ('VT-MOUSSE-200',  'Mousse volumen 200 ml',                'Schwarzkopf', 'Venta', null, 'unit', 'Aerosol 200 ml', null, 3, 5, 3, 3),
  ('VT-KIT-VIAJE',   'Kit de viaje (3 miniaturas)',          'Kérastase', 'Venta', null, 'unit', 'Kit', null, 2, 4, 2, 5);

insert into public.products (chain_id, sku, name, brand, category, variant, unit, presentation, presentation_qty)
select '11111111-1111-4111-8111-111111111111', sku, name, brand, category, variant, unit, presentation, presentation_qty
  from seed_products;

-- Inventario en ambas sucursales, todo inicializado.
insert into public.inventory (chain_id, branch_id, product_id, balance, min_qty, initialized_at)
select p.chain_id, '22222222-2222-4222-8222-222222222201', p.id, s.bal_cen, s.min_cen, now()
  from seed_products s join public.products p on p.chain_id = '11111111-1111-4111-8111-111111111111' and p.sku = s.sku
union all
select p.chain_id, '22222222-2222-4222-8222-222222222202', p.id, s.bal_poc, s.min_poc, now()
  from seed_products s join public.products p on p.chain_id = '11111111-1111-4111-8111-111111111111' and p.sku = s.sku;

-- Una operación de carga inicial por sucursal, con un movimiento por producto con saldo > 0.
insert into public.operations (id, chain_id, type, actor_profile_id, idempotency_key, request_hash, reference) values
  ('44444444-4444-4444-8444-444444444401', '11111111-1111-4111-8111-111111111111', 'initial', '33333333-3333-4333-8333-333333333301', gen_random_uuid(), 'seed', 'Carga inicial Centro'),
  ('44444444-4444-4444-8444-444444444402', '11111111-1111-4111-8111-111111111111', 'initial', '33333333-3333-4333-8333-333333333301', gen_random_uuid(), 'seed', 'Carga inicial Pocitos');

insert into public.movements (chain_id, operation_id, product_id, branch_id, qty_delta, unit)
select i.chain_id,
       case i.branch_id when '22222222-2222-4222-8222-222222222201' then '44444444-4444-4444-8444-444444444401'
                        else '44444444-4444-4444-8444-444444444402' end,
       i.product_id, i.branch_id, i.balance, p.unit
  from public.inventory i join public.products p on p.id = i.product_id
 where i.chain_id = '11111111-1111-4111-8111-111111111111' and i.balance > 0;

-- Alertas abiertas donde saldo <= mínimo.
insert into public.alerts (chain_id, branch_id, product_id)
select chain_id, branch_id, product_id from public.inventory
 where chain_id = '11111111-1111-4111-8111-111111111111' and balance <= min_qty;

drop table seed_products;

-- Re-vincular cuentas Auth existentes (tras un re-seed los perfiles se recrean).
update public.profiles p
   set auth_user_id = u.id
  from auth.users u
 where p.chain_id = '11111111-1111-4111-8111-111111111111'
   and p.auth_user_id is null
   and lower(u.email) = lower(p.email)
   and not exists (select 1 from public.profiles q where q.auth_user_id = u.id);
