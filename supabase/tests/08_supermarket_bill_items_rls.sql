begin;
select plan(3);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111114', 'usera_007@example.com'),
  ('22222222-2222-2222-2222-222222222225', 'userb_007@example.com');

select is(
  (select count(*)::int from public.categories where user_id = '11111111-1111-1111-1111-111111111114' and name = 'Supermercado'),
  1,
  'Trigger cria categoria padrão Supermercado'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111114', true);

insert into public.bills (id, user_id, description, category_id, amount_cents, payment_type, due_date, status, supermarket_payment_method)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '11111111-1111-1111-1111-111111111114',
  'Compra Assaí',
  (select id from public.categories where name = 'Supermercado' limit 1),
  25000,
  'credit',
  '2026-11-27',
  'paid',
  'food_voucher'
);

insert into public.bill_items (bill_id, user_id, description, item_category, quantity, unit, unit_price_cents, total_cents)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111114', 'Sabão em pó', 'cleaning', 1, 'kg', 1590, 1590);

select is((select count(*)::int from public.bill_items), 1, 'Usuário A vê seus subitens');

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222225', true);

select is((select count(*)::int from public.bill_items), 0, 'Usuário B não vê subitens do usuário A (RLS)');

select * from finish();
rollback;
