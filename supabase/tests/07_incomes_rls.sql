begin;
select plan(4);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111113', 'usera_005@example.com'),
  ('22222222-2222-2222-2222-222222222224', 'userb_005@example.com');

select is(
  (select count(*)::int from public.income_types where user_id = '11111111-1111-1111-1111-111111111113'),
  3,
  'Trigger cria 3 tipos de renda padrão (Salário, Freela, Outros)'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111113', true);

insert into public.incomes (user_id, description, amount_cents, received_date, nature, income_type_id)
values (
  '11111111-1111-1111-1111-111111111113',
  'Salário Novembro',
  500000,
  '2026-11-05',
  'fixed',
  (select id from public.income_types where name = 'Salário' limit 1)
);

select is(
  (select total_income_cents::int from public.monthly_income_summary('2026-11-01')),
  500000,
  'monthly_income_summary soma corretamente as rendas do mês'
);

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222224', true);

select is((select count(*)::int from public.incomes), 0, 'Usuário B não vê rendas do usuário A');
select is(
  (select total_income_cents::int from public.monthly_income_summary('2026-11-01')),
  0,
  'monthly_income_summary respeita isolamento por usuário'
);

select * from finish();
rollback;
