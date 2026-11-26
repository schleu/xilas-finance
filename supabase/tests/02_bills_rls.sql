begin;

select plan(20);

-- Setup: create two users via auth.users (triggers default categories)
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
    'alice-bills@example.com',
    '{"display_name":"Alice"}'::jsonb,
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'bob-bills@example.com',
    '{"display_name":"Bob"}'::jsonb,
    now(),
    now()
  );

select set_config(
  'test.user_a_cat',
  (select id::text from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and name = 'Fixa'),
  true
);

select set_config(
  'test.user_b_cat',
  (select id::text from public.categories where user_id = '22222222-2222-2222-2222-222222222222' and name = 'Fixa'),
  true
);

-- As User A
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    insert into public.bills (user_id, description, category_id, amount_cents, payment_type, due_date, status)
    values (
      '11111111-1111-1111-1111-111111111111',
      'Internet',
      current_setting('test.user_a_cat')::uuid,
      12050,
      'pix',
      '2026-12-10',
      'pending'
    )
  $$,
  'User A can insert valid pix bill'
);

select throws_ok(
  $$
    insert into public.bills (user_id, description, category_id, amount_cents, payment_type, due_date, status)
    values (
      '11111111-1111-1111-1111-111111111111',
      'Valor zero',
      current_setting('test.user_a_cat')::uuid,
      0,
      'pix',
      '2026-12-10',
      'pending'
    )
  $$,
  '23514',
  null,
  'amount_cents <= 0 is rejected'
);

select throws_ok(
  $$
    insert into public.bills (user_id, description, category_id, amount_cents, payment_type, due_date, status)
    values (
      '11111111-1111-1111-1111-111111111111',
      '   ',
      current_setting('test.user_a_cat')::uuid,
      1000,
      'pix',
      '2026-12-10',
      'pending'
    )
  $$,
  '23514',
  null,
  'blank description is rejected'
);

select throws_ok(
  $$
    insert into public.bills (user_id, description, category_id, amount_cents, payment_type, due_date, status)
    values (
      '11111111-1111-1111-1111-111111111111',
      repeat('a', 121),
      current_setting('test.user_a_cat')::uuid,
      1000,
      'pix',
      '2026-12-10',
      'pending'
    )
  $$,
  '23514',
  null,
  'description longer than 120 chars is rejected'
);

select throws_ok(
  $$
    insert into public.bills (user_id, description, category_id, amount_cents, payment_type, due_date, status)
    values (
      '11111111-1111-1111-1111-111111111111',
      'Energia',
      current_setting('test.user_a_cat')::uuid,
      25000,
      'debit',
      '2026-12-15',
      'pending'
    )
  $$,
  '23514',
  null,
  'debit payment_type requires bank, agency and account_number'
);

select lives_ok(
  $$
    insert into public.bills (
      user_id, description, category_id, amount_cents, payment_type,
      bank, agency, account_number, due_date, status
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      'Energia',
      current_setting('test.user_a_cat')::uuid,
      25000,
      'debit',
      'Banco do Brasil',
      '1234',
      '56789-0',
      '2026-12-15',
      'pending'
    )
  $$,
  'debit payment_type succeeds with bank, agency and account_number'
);

select throws_ok(
  $$
    insert into public.bills (
      user_id, description, category_id, amount_cents, payment_type,
      bank, agency, account_number, due_date, status
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      'Pix com banco',
      current_setting('test.user_a_cat')::uuid,
      5000,
      'pix',
      'Banco X',
      '0001',
      '12345',
      '2026-12-15',
      'pending'
    )
  $$,
  '23514',
  null,
  'non-debit payment_type rejects bank details'
);

select throws_ok(
  $$
    insert into public.bills (user_id, description, category_id, amount_cents, payment_type, due_date, status, paid_at)
    values (
      '11111111-1111-1111-1111-111111111111',
      'Pendente com data',
      current_setting('test.user_a_cat')::uuid,
      5000,
      'pix',
      '2026-12-15',
      'pending',
      '2026-11-26'
    )
  $$,
  '23514',
  null,
  'pending status rejects non-null paid_at'
);

select lives_ok(
  $$
    insert into public.bills (user_id, description, category_id, amount_cents, payment_type, due_date, status, paid_at)
    values (
      '11111111-1111-1111-1111-111111111111',
      'Água',
      current_setting('test.user_a_cat')::uuid,
      9000,
      'credit',
      '2026-11-20',
      'paid',
      '2026-11-20'
    )
  $$,
  'paid status allows paid_at'
);

select throws_ok(
  $$ delete from public.categories where id = current_setting('test.user_a_cat')::uuid $$,
  '23503',
  null,
  'cannot delete category referenced by existing bills'
);

select throws_ok(
  $$
    insert into public.bills (user_id, description, category_id, amount_cents, payment_type, due_date, status)
    values (
      '22222222-2222-2222-2222-222222222222',
      'Injetada',
      current_setting('test.user_b_cat')::uuid,
      1000,
      'pix',
      '2026-12-10',
      'pending'
    )
  $$,
  '42501',
  null,
  'User A cannot insert bill for User B'
);

select throws_ok(
  $$
    insert into public.bills (user_id, description, category_id, amount_cents, payment_type, due_date, status)
    values (
      '11111111-1111-1111-1111-111111111111',
      'Categoria alheia',
      current_setting('test.user_b_cat')::uuid,
      1000,
      'pix',
      '2026-12-10',
      'pending'
    )
  $$,
  '42501',
  null,
  'User A cannot insert bill referencing User B category'
);

-- As User B
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    insert into public.bills (user_id, description, category_id, amount_cents, payment_type, due_date, status)
    values (
      '22222222-2222-2222-2222-222222222222',
      'Aluguel Bob',
      current_setting('test.user_b_cat')::uuid,
      180000,
      'credit',
      '2026-12-05',
      'pending'
    )
  $$,
  'User B can insert own bill'
);

select is(
  (select count(*)::int from public.bills),
  1,
  'User B sees only own 1 bill'
);

select is(
  (select count(*)::int from public.bills where user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'User B cannot see User A bills'
);

-- Back to User A: verify isolation on select, update, reassign, delete
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

select is(
  (select count(*)::int from public.bills),
  3,
  'User A sees only own 3 bills'
);

select is(
  (select count(*)::int from public.bills where user_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'User A cannot see User B bills'
);

update public.bills
set description = 'Hacked'
where user_id = '22222222-2222-2222-2222-222222222222';

select throws_ok(
  $$
    update public.bills
    set user_id = '22222222-2222-2222-2222-222222222222'
    where user_id = '11111111-1111-1111-1111-111111111111' and description = 'Internet'
  $$,
  '42501',
  null,
  'User A cannot reassign own bill to User B'
);

delete from public.bills
where user_id = '22222222-2222-2222-2222-222222222222';

-- Verify as postgres that User B bill is intact
reset role;

select is(
  (select description from public.bills where user_id = '22222222-2222-2222-2222-222222222222'),
  'Aluguel Bob',
  'User B bill was neither modified nor deleted by User A'
);

-- Verify anon sees 0 bills
set local role anon;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*)::int from public.bills),
  0,
  'anon cannot see any bills'
);

reset role;

select * from finish();

rollback;
