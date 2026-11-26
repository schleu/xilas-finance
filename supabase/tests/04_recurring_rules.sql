begin;

select plan(14);

-- Setup: two users
insert into auth.users (
  id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'alice-rec@example.com',
    '{"display_name":"Alice"}'::jsonb,
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'bob-rec@example.com',
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
  'test.user_b_fixa',
  (select id::text from public.categories where user_id = '22222222-2222-2222-2222-222222222222' and name = 'Fixa'),
  true
);

-- Authenticate as User A
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

-- 1: create active rule with due_day = 31 starting Jan 2026
with created as (
  insert into public.recurring_rules (
    user_id, description, company, category_id, amount_cents, payment_type, due_day, start_month, active
  )
  values (
    '11111111-1111-1111-1111-111111111111',
    'Aluguel',
    'Imobiliária',
    current_setting('test.user_a_fixa')::uuid,
    200000,
    'pix',
    31,
    '2026-01-01',
    true
  )
  returning id
)
select set_config('test.rule_a_31', (select id::text from created), true);

-- Create an inactive rule (must NOT generate any bills)
with created as (
  insert into public.recurring_rules (
    user_id, description, category_id, amount_cents, payment_type, due_day, start_month, active
  )
  values (
    '11111111-1111-1111-1111-111111111111',
    'Academia Encerrada',
    current_setting('test.user_a_fixa')::uuid,
    12000,
    'credit',
    10,
    '2026-01-01',
    false
  )
  returning id
)
select set_config('test.rule_a_inactive', (select id::text from created), true);

-- 1: First generation on 2026-01-15 creates 3 bills (Jan, Feb, Mar 2026)
select is(
  public.generate_recurring_bills('2026-01-15'),
  3,
  'generate_recurring_bills creates 3 bills (current month + next 2) for active rule only'
);

-- 2: February 2026 (non-leap) clamps due_day 31 -> 2026-02-28
select results_eq(
  $$
    select due_date, status::text
    from public.bills
    where recurring_rule_id = current_setting('test.rule_a_31')::uuid
    order by due_date asc
  $$,
  $$
    values
      ('2026-01-31'::date, 'pending'::text),
      ('2026-02-28'::date, 'pending'::text),
      ('2026-03-31'::date, 'pending'::text)
  $$,
  'day 31 clamps to Feb 28 in non-leap year 2026 and all generated bills start pending'
);

-- 3: Idempotency: calling again on same reference date inserts 0 rows
select is(
  public.generate_recurring_bills('2026-01-20'),
  0,
  'generate_recurring_bills is idempotent (second run inserts 0 rows)'
);

-- 4: Inactive rule generated 0 bills
select is(
  (select count(*)::int from public.bills where recurring_rule_id = current_setting('test.rule_a_inactive')::uuid),
  0,
  'inactive recurring rule generates 0 bills'
);

-- 5: Leap year February 2028 clamps due_day 31 -> 2028-02-29
select is(
  public.generate_recurring_bills('2028-02-01'),
  3,
  'generate_recurring_bills generates Feb/Mar/Apr 2028'
);

select results_eq(
  $$
    select due_date
    from public.bills
    where recurring_rule_id = current_setting('test.rule_a_31')::uuid
      and due_date >= '2028-02-01'
    order by due_date asc
  $$,
  $$
    values
      ('2028-02-29'::date),
      ('2028-03-31'::date),
      ('2028-04-30'::date)
  $$,
  'day 31 clamps to Feb 29 in leap year 2028 and Apr 30 in April'
);

-- 7: start_month guard: rule starting in 2026-03-01 only generates Mar when ref is Jan 2026
with created as (
  insert into public.recurring_rules (
    user_id, description, category_id, amount_cents, payment_type, due_day, start_month, active
  )
  values (
    '11111111-1111-1111-1111-111111111111',
    'Seguro Futuro',
    current_setting('test.user_a_fixa')::uuid,
    9000,
    'pix',
    15,
    '2026-03-01',
    true
  )
  returning id
)
select set_config('test.rule_a_future', (select id::text from created), true);

select is(
  public.generate_recurring_bills('2026-01-15', current_setting('test.rule_a_future')::uuid),
  1,
  'rule with future start_month does not generate bills before start_month'
);

-- 8: Constraint checks on recurring_rules
select throws_ok(
  $$
    insert into public.recurring_rules (
      user_id, description, category_id, amount_cents, payment_type, due_day, start_month
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      'Dia inválido',
      current_setting('test.user_a_fixa')::uuid,
      1000,
      'pix',
      32,
      '2026-01-01'
    )
  $$,
  '23514',
  null,
  'due_day > 31 is rejected'
);

select throws_ok(
  $$
    insert into public.recurring_rules (
      user_id, description, category_id, amount_cents, payment_type, due_day, start_month
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      'Débito sem banco',
      current_setting('test.user_a_fixa')::uuid,
      1000,
      'debit',
      10,
      '2026-01-01'
    )
  $$,
  '23514',
  null,
  'debit recurring rule requires bank, agency and account_number'
);

-- 10-12: RLS isolation as User B
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);

select is(
  (select count(*)::int from public.recurring_rules),
  0,
  'User B sees 0 of User A recurring rules'
);

select throws_ok(
  $$
    insert into public.recurring_rules (
      user_id, description, category_id, amount_cents, payment_type, due_day, start_month
    )
    values (
      '22222222-2222-2222-2222-222222222222',
      'Categoria alheia',
      current_setting('test.user_a_fixa')::uuid,
      1000,
      'pix',
      10,
      '2026-01-01'
    )
  $$,
  '42501',
  null,
  'User B cannot create recurring rule referencing User A category'
);

select is(
  public.generate_recurring_bills('2026-05-01'),
  0,
  'User B running generate_recurring_bills does not generate bills for User A'
);

-- 13-14: anon cannot read recurring_rules or execute generate_recurring_bills
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*)::int from public.recurring_rules),
  0,
  'anon sees 0 recurring_rules'
);

select throws_ok(
  $$ select public.generate_recurring_bills('2026-01-15') $$,
  '42501',
  null,
  'anon cannot execute generate_recurring_bills'
);

reset role;

select * from finish();

rollback;
