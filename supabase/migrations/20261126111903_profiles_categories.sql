-- Profiles and categories schema, RLS policies, and onboarding trigger (T-05)

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(btrim(name)) > 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index categories_user_id_lower_name_key
  on public.categories (user_id, lower(btrim(name)));

alter table public.categories enable row level security;

create policy "categories_select_own"
  on public.categories
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "categories_insert_own"
  on public.categories
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "categories_update_own"
  on public.categories
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "categories_delete_own"
  on public.categories
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name'
    )
  )
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, is_default)
  values
    (new.id, 'Fixa', true),
    (new.id, 'Variável', true),
    (new.id, 'Cartão de Crédito', true)
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
