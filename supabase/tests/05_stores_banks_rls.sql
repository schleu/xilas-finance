begin;
select plan(5);

-- Create two isolated users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'usera_003@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'userb_003@example.com');

-- 1. Trigger seeded 10 default stores for user A
select is(
  (select count(*)::int from public.stores where user_id = '11111111-1111-1111-1111-111111111111'),
  10,
  'Trigger cria 10 lojas padrão (4 online + 6 supermercados)'
);

-- Switch to user A
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

-- 2. User A can insert a bank with debit account + credit card due day
insert into public.banks (user_id, name, has_debit_account, agency, account_number, has_credit_card, credit_card_due_day)
values ('11111111-1111-1111-1111-111111111111', 'Nubank', true, '0001', '123456', true, 10);

select is(
  (select count(*)::int from public.banks),
  1,
  'Usuário A vê apenas seus próprios bancos'
);

-- 3. Check constraint blocks credit card without due day
select throws_ok(
  $$insert into public.banks (user_id, name, has_credit_card, credit_card_due_day)
    values ('11111111-1111-1111-1111-111111111111', 'Sem Venc', true, null)$$,
  '23514',
  null,
  'Cartão de crédito exige dia de vencimento'
);

-- Switch to user B
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

-- 4. User B cannot see user A banks
select is(
  (select count(*)::int from public.banks),
  0,
  'Usuário B não vê bancos do usuário A (RLS)'
);

-- 5. User B sees only own 10 stores (not user A's 10)
select is(
  (select count(*)::int from public.stores),
  10,
  'Usuário B vê apenas suas próprias lojas (RLS)'
);

select * from finish();
rollback;
