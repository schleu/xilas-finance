-- Chat conversations and messages persistence with RLS (004 / T-03)

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  conversation_date date not null,
  model_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_conversations_user_date_idx
  on public.chat_conversations (user_id, conversation_date desc, updated_at desc);

alter table public.chat_conversations enable row level security;

create policy "chat_conversations_select_own"
  on public.chat_conversations for select to authenticated
  using (user_id = (select auth.uid()));

create policy "chat_conversations_insert_own"
  on public.chat_conversations for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "chat_conversations_update_own"
  on public.chat_conversations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "chat_conversations_delete_own"
  on public.chat_conversations for delete to authenticated
  using (user_id = (select auth.uid()));

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model_id text,
  used_fallback boolean not null default false,
  proposed_bill jsonb,
  created_at timestamptz not null default now()
);

create index chat_messages_conversation_idx
  on public.chat_messages (conversation_id, created_at asc);

alter table public.chat_messages enable row level security;

create policy "chat_messages_select_own"
  on public.chat_messages for select to authenticated
  using (user_id = (select auth.uid()));

create policy "chat_messages_insert_own"
  on public.chat_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

create policy "chat_messages_delete_own"
  on public.chat_messages for delete to authenticated
  using (user_id = (select auth.uid()));
