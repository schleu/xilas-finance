begin;

select plan(17);

-- Setup: create two users via auth.users (triggers default categories: Fixa, Variável, Cartão de Crédito)
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'alice-read@example.com',
    '{"display_name":"Alice"}'::jsonb,
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'bob-read@example.com',
    '{"display_name":"Bob"}'::jsonb,
    now(),
    now()
  );

select set_config(
  'test.user_a_fixa',
  (select id::text from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and name = 'Fixa'),
  true
);
select set_config(
  'test.user_a_variavel',
  (select id::text from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and name = 'Variável'),
  true
);
select set_config(
  'test.user_a_cartao',
  (select id::text from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and name = 'Cartão de Crédito'),
  true
);
select set_config(
  'test.user_b_fixa',
  (select id::text from public.categories where user_id = '22222222-2222-2222-2222-222222222222' and name = 'Fixa'),
  true
);

-- Seed bills for User A across multiple months (reference month = due_date)
-- November 2026 (today = 2026-11-20):
--   - Paid Fixa: 150000 (Aluguel, due 2026-11-05, paid 2026-11-05)
--   - Paid Fixa: 12050 (Internet, due 2026-11-10, paid 2026-12-02 -> still belongs to Nov by due_date)
--   - Paid Variável: 45000 (Mercado, due 2026-11-15, paid 2026-11-15)
--   - Pending overdue: 25000 (Energia, due 2026-11-10 < 2026-11-20)
--   - Pending overdue: 8000 (Água, due 2026-11-19 < 2026-11-20)
--   - Pending not overdue (due today): 10000 (Streaming, due 2026-11-20 = today)
--   - Pending future: 30000 (Cartão, due 2026-11-28)
-- October 2026:
--   - Paid Fixa: 150000 (Aluguel Out, due 2026-10-05)
--   - Pending: 9999 (Unpaid Out, due 2026-10-10)
-- August 2026:
--   - Paid Variável: 60000 (Viagem, due 2026-08-12)
-- (June, July, September 2026 have 0 paid bills)
insert into public.bills (user_id, description, category_id, amount_cents, payment_type, due_date, status, paid_at)
values
  ('11111111-1111-1111-1111-111111111111', 'Aluguel Nov', current_setting('test.user_a_fixa')::uuid, 150000, 'pix', '2026-11-05', 'paid', '2026-11-05'),
  ('11111111-1111-1111-1111-111111111111', 'Internet Nov', current_setting('test.user_a_fixa')::uuid, 12050, 'pix', '2026-11-10', 'paid', '2026-12-02'),
  ('11111111-1111-1111-1111-111111111111', 'Mercado Nov', current_setting('test.user_a_variavel')::uuid, 45000, 'credit', '2026-11-15', 'paid', '2026-11-15'),
  ('11111111-1111-1111-1111-111111111111', 'Energia Nov', current_setting('test.user_a_fixa')::uuid, 25000, 'pix', '2026-11-10', 'pending', null),
  ('11111111-1111-1111-1111-111111111111', 'Água Nov', current_setting('test.user_a_fixa')::uuid, 8000, 'pix', '2026-11-19', 'pending', null),
  ('11111111-1111-1111-1111-111111111111', 'Streaming Nov', current_setting('test.user_a_variavel')::uuid, 10000, 'credit', '2026-11-20', 'pending', null),
  ('11111111-1111-1111-1111-111111111111', 'Fatura Nov', current_setting('test.user_a_cartao')::uuid, 30000, 'credit', '2026-11-28', 'pending', null),
  ('11111111-1111-1111-1111-111111111111', 'Aluguel Out', current_setting('test.user_a_fixa')::uuid, 150000, 'pix', '2026-10-05', 'paid', '2026-10-05'),
  ('11111111-1111-1111-1111-111111111111', 'Pendente Out', current_setting('test.user_a_variavel')::uuid, 9999, 'pix', '2026-10-10', 'pending', null),
  ('11111111-1111-1111-1111-111111111111', 'Viagem Ago', current_setting('test.user_a_variavel')::uuid, 60000, 'credit', '2026-08-12', 'paid', '2026-08-12');

-- Seed bills for User B in November 2026 (must never leak to User A)
insert into public.bills (user_id, description, category_id, amount_cents, payment_type, due_date, status, paid_at)
values
  ('22222222-2222-2222-2222-222222222222', 'Aluguel Bob', current_setting('test.user_b_fixa')::uuid, 500000, 'pix', '2026-11-05', 'paid', '2026-11-05'),
  ('22222222-2222-2222-2222-222222222222', 'Atrasada Bob', current_setting('test.user_b_fixa')::uuid, 77700, 'pix', '2026-11-01', 'pending', null);

-- Authenticate as User A
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

-- 1-4: monthly_summary for November 2026 (today = 2026-11-20)
select is(
  (select month from public.monthly_summary('2026-11-15', '2026-11-20')),
  '2026-11-01'::date,
  'monthly_summary normalizes p_month to first day of month'
);

select is(
  (select paid_total_cents from public.monthly_summary('2026-11-01', '2026-11-20')),
  207050::bigint,
  'monthly_summary sums only paid bills in reference month by due_date (150000 + 12050 + 45000)'
);

select is(
  (select pending_total_cents from public.monthly_summary('2026-11-01', '2026-11-20')),
  73000::bigint,
  'monthly_summary sums pending bills separately (25000 + 8000 + 10000 + 30000)'
);

select is(
  (select overdue_count from public.monthly_summary('2026-11-01', '2026-11-20')),
  2,
  'monthly_summary counts only pending bills with due_date strictly before today'
);

-- 5: monthly_summary for empty month returns 1 row of zeros
select results_eq(
  $$ select month, paid_total_cents, pending_total_cents, overdue_count from public.monthly_summary('2026-01-01', '2026-11-20') $$,
  $$ values ('2026-01-01'::date, 0::bigint, 0::bigint, 0::integer) $$,
  'monthly_summary returns a single zero row when month has no bills'
);

-- 6: monthly_summary uses due_date, not paid_at (Internet Nov paid in Dec does not appear in Dec)
select is(
  (select paid_total_cents from public.monthly_summary('2026-12-01', '2026-12-10')),
  0::bigint,
  'bill due in November and paid in December is not counted in December'
);

-- 7-8: spending_by_category for November 2026 (only paid, ordered desc)
select results_eq(
  $$
    select category_name, paid_total_cents, bills_count
    from public.spending_by_category('2026-11-01', '2026-11-30')
  $$,
  $$
    values
      ('Fixa'::text, 162050::bigint, 2::integer),
      ('Variável'::text, 45000::bigint, 1::integer)
  $$,
  'spending_by_category returns only paid totals per category ordered descending (excludes pending-only Cartão de Crédito)'
);

-- 8: spending_by_category over multi-month range matches sum of paid bills
select results_eq(
  $$
    select category_name, paid_total_cents, bills_count
    from public.spending_by_category('2026-10-01', '2026-11-30')
  $$,
  $$
    values
      ('Fixa'::text, 312050::bigint, 3::integer),
      ('Variável'::text, 45000::bigint, 1::integer)
  $$,
  'spending_by_category aggregates paid bills across multi-month range'
);

-- 9: spending_by_category total equals monthly_summary paid_total_cents
select is(
  (select coalesce(sum(paid_total_cents), 0)::bigint from public.spending_by_category('2026-11-01', '2026-11-30')),
  (select paid_total_cents from public.monthly_summary('2026-11-01', '2026-11-20')),
  'sum of spending_by_category matches monthly_summary paid_total_cents'
);

-- 10: monthly_evolution returns 6 months in ascending order with zeros for empty months
select results_eq(
  $$
    select month, paid_total_cents
    from public.monthly_evolution(6, '2026-11-01')
  $$,
  $$
    values
      ('2026-06-01'::date, 0::bigint),
      ('2026-07-01'::date, 0::bigint),
      ('2026-08-01'::date, 60000::bigint),
      ('2026-09-01'::date, 0::bigint),
      ('2026-10-01'::date, 150000::bigint),
      ('2026-11-01'::date, 207050::bigint)
  $$,
  'monthly_evolution returns 6 chronological months with paid-only totals and zero-filled gaps'
);

-- 11: monthly_evolution rejects invalid p_months
select throws_ok(
  $$ select * from public.monthly_evolution(0, '2026-11-01') $$,
  '22023',
  null,
  'monthly_evolution rejects p_months < 1'
);

-- 12-14: RLS isolation as User B
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);

select results_eq(
  $$ select paid_total_cents, pending_total_cents, overdue_count from public.monthly_summary('2026-11-01', '2026-11-20') $$,
  $$ values (500000::bigint, 77700::bigint, 1::integer) $$,
  'User B monthly_summary sees only User B bills'
);

select results_eq(
  $$ select category_name, paid_total_cents, bills_count from public.spending_by_category('2026-11-01', '2026-11-30') $$,
  $$ values ('Fixa'::text, 500000::bigint, 1::integer) $$,
  'User B spending_by_category sees only User B bills'
);

select is(
  (select paid_total_cents from public.monthly_evolution(2, '2026-11-01') where month = '2026-11-01'),
  500000::bigint,
  'User B monthly_evolution sees only User B bills'
);

-- 15-17: anon cannot execute any of the reporting functions
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);

select throws_ok(
  $$ select * from public.monthly_summary('2026-11-01', '2026-11-20') $$,
  '42501',
  null,
  'anon cannot execute monthly_summary'
);

select throws_ok(
  $$ select * from public.spending_by_category('2026-11-01', '2026-11-30') $$,
  '42501',
  null,
  'anon cannot execute spending_by_category'
);

select throws_ok(
  $$ select * from public.monthly_evolution(6, '2026-11-01') $$,
  '42501',
  null,
  'anon cannot execute monthly_evolution'
);

reset role;

select * from finish();

rollback;
