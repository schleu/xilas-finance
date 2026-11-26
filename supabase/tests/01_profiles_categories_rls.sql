begin;

select plan(28);

-- Setup: create two users via auth.users (triggers onboarding in public.profiles and public.categories)
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
    'alice@example.com',
    '{"display_name":"Alice"}'::jsonb,
    now(),
    now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'bob@example.com',
    '{"display_name":"Bob"}'::jsonb,
    now(),
    now()
  );

-- 1. Onboarding trigger (US-0 / US-3)
select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice',
  'trigger creates profile for User A'
);

select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'Bob',
  'trigger creates profile for User B'
);

select is(
  (
    select array_agg(name order by name)
    from public.categories
    where user_id = '11111111-1111-1111-1111-111111111111' and is_default = true
  ),
  array['Cartão de Crédito', 'Fixa', 'Variável'],
  'trigger creates 3 default categories for User A'
);

select is(
  (
    select array_agg(name order by name)
    from public.categories
    where user_id = '22222222-2222-2222-2222-222222222222' and is_default = true
  ),
  array['Cartão de Crédito', 'Fixa', 'Variável'],
  'trigger creates 3 default categories for User B'
);

-- 2. RLS & ownership on public.profiles (US-0)
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

select is(
  (select count(*)::int from public.profiles),
  1,
  'User A sees only 1 profile'
);

select is(
  (select count(*)::int from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  0,
  'User A cannot see User B profile'
);

update public.profiles
set display_name = 'Alice Silva'
where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alice Silva',
  'User A can update own profile'
);

update public.profiles
set display_name = 'Hacked'
where id = '22222222-2222-2222-2222-222222222222';

select throws_ok(
  $$ insert into public.profiles (id, display_name) values ('22222222-2222-2222-2222-222222222222', 'Fake') $$,
  '42501',
  null,
  'User A cannot insert profile for User B'
);

delete from public.profiles
where id = '22222222-2222-2222-2222-222222222222';

reset role;

select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'Bob',
  'User B profile was not modified by User A'
);

select is(
  (select count(*)::int from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  1,
  'User B profile was not deleted by User A'
);

set local role anon;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*)::int from public.profiles),
  0,
  'anon cannot see any profiles'
);

-- 3. RLS, CRUD, and case-insensitive uniqueness on public.categories (US-0 / US-3)
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

select is(
  (select count(*)::int from public.categories),
  3,
  'User A sees only their 3 categories'
);

select is(
  (select count(*)::int from public.categories where user_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'User A cannot see User B categories'
);

select lives_ok(
  $$ insert into public.categories (user_id, name) values ('11111111-1111-1111-1111-111111111111', 'Lazer') $$,
  'User A can insert custom category'
);

select is(
  (select is_default from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and name = 'Lazer'),
  false,
  'custom category defaults to is_default = false'
);

select throws_ok(
  $$ insert into public.categories (user_id, name) values ('11111111-1111-1111-1111-111111111111', 'lazer') $$,
  '23505',
  null,
  'category name is unique case-insensitively'
);

select throws_ok(
  $$ insert into public.categories (user_id, name) values ('11111111-1111-1111-1111-111111111111', '  FIXA  ') $$,
  '23505',
  null,
  'category name uniqueness ignores leading/trailing spaces and case'
);

select throws_ok(
  $$ insert into public.categories (user_id, name) values ('11111111-1111-1111-1111-111111111111', '   ') $$,
  '23514',
  null,
  'blank category name is rejected'
);

select throws_ok(
  $$ insert into public.categories (user_id, name) values ('22222222-2222-2222-2222-222222222222', 'Injected') $$,
  '42501',
  null,
  'User A cannot insert category for User B'
);

update public.categories
set name = 'Hacked'
where user_id = '22222222-2222-2222-2222-222222222222';

select throws_ok(
  $$ update public.categories set user_id = '22222222-2222-2222-2222-222222222222' where user_id = '11111111-1111-1111-1111-111111111111' and name = 'Lazer' $$,
  '42501',
  null,
  'User A cannot reassign own category to User B'
);

select lives_ok(
  $$ update public.categories set name = 'Lazer e Viagens' where user_id = '11111111-1111-1111-1111-111111111111' and name = 'Lazer' $$,
  'User A can rename own category'
);

delete from public.categories
where user_id = '22222222-2222-2222-2222-222222222222';

select lives_ok(
  $$ delete from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and name = 'Lazer e Viagens' $$,
  'User A can delete own category'
);

select is(
  (select count(*)::int from public.categories),
  3,
  'User A is back to 3 categories after deleting custom one'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);

select lives_ok(
  $$ insert into public.categories (user_id, name) values ('22222222-2222-2222-2222-222222222222', 'Lazer') $$,
  'User B can create category with name previously used by another user'
);

select is(
  (select count(*)::int from public.categories),
  4,
  'User B sees 4 categories'
);

select is(
  (select count(*)::int from public.categories where user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'User B cannot see User A categories'
);

reset role;

select is(
  (
    select array_agg(name order by name)
    from public.categories
    where user_id = '22222222-2222-2222-2222-222222222222' and is_default = true
  ),
  array['Cartão de Crédito', 'Fixa', 'Variável'],
  'User B default categories were neither modified nor deleted by User A'
);

set local role anon;
select set_config('request.jwt.claims', '', true);

select is(
  (select count(*)::int from public.categories),
  0,
  'anon cannot see any categories'
);

reset role;

select * from finish();

rollback;
