begin;
select plan(3);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111112', 'usera_004@example.com'),
  ('22222222-2222-2222-2222-222222222223', 'userb_004@example.com');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111112', true);

insert into public.chat_conversations (id, user_id, title, conversation_date)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111112', 'Conversa de hoje', '2026-11-27');

insert into public.chat_messages (conversation_id, user_id, role, content)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111112', 'user', 'Oi');

select is((select count(*)::int from public.chat_messages), 1, 'Usuário A vê sua mensagem');

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222223', true);

select is((select count(*)::int from public.chat_conversations), 0, 'Usuário B não vê conversas do usuário A');
select is((select count(*)::int from public.chat_messages), 0, 'Usuário B não vê mensagens do usuário A');

select * from finish();
rollback;
