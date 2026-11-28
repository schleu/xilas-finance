-- Stores and banks schema, RLS, FKs on bills/recurring_rules, and default stores seed (003 / T-01)

create type public.store_type as enum ('online', 'physical');
create type public.store_subtype as enum ('supermarket', 'other');

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  store_type public.store_type not null,
  store_subtype public.store_subtype,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  check (store_type = 'physical' or store_subtype is null)
);

create unique index stores_user_id_lower_name_key
  on public.stores (user_id, lower(btrim(name)));

create index stores_user_id_type_idx
  on public.stores (user_id, store_type, store_subtype);

alter table public.stores enable row level security;

create policy "stores_select_own"
  on public.stores for select to authenticated
  using (user_id = (select auth.uid()));

create policy "stores_insert_own"
  on public.stores for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "stores_update_own"
  on public.stores for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "stores_delete_own"
  on public.stores for delete to authenticated
  using (user_id = (select auth.uid()));

create table public.banks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  has_debit_account boolean not null default false,
  agency text,
  account_number text,
  has_credit_card boolean not null default false,
  credit_card_label text,
  credit_card_due_day smallint check (credit_card_due_day between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    not has_debit_account
    or (
      agency is not null and char_length(btrim(agency)) > 0
      and account_number is not null and char_length(btrim(account_number)) > 0
    )
  ),
  check (not has_credit_card or credit_card_due_day is not null)
);

create index banks_user_id_idx on public.banks (user_id);

alter table public.banks enable row level security;

create policy "banks_select_own"
  on public.banks for select to authenticated
  using (user_id = (select auth.uid()));

create policy "banks_insert_own"
  on public.banks for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "banks_update_own"
  on public.banks for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "banks_delete_own"
  on public.banks for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.bills
  add column store_id uuid references public.stores (id) on delete set null,
  add column bank_id uuid references public.banks (id) on delete set null;

alter table public.recurring_rules
  add column store_id uuid references public.stores (id) on delete set null,
  add column bank_id uuid references public.banks (id) on delete set null;

-- Update onboarding trigger to also seed default online stores and supermarkets
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

  insert into public.stores (user_id, name, store_type, store_subtype, is_default)
  values
    (new.id, 'Amazon', 'online'::public.store_type, null, true),
    (new.id, 'Shopee', 'online'::public.store_type, null, true),
    (new.id, 'AliExpress', 'online'::public.store_type, null, true),
    (new.id, 'Mercado Livre', 'online'::public.store_type, null, true),
    (new.id, 'Assaí', 'physical'::public.store_type, 'supermarket'::public.store_subtype, true),
    (new.id, 'Pão de Açúcar', 'physical'::public.store_type, 'supermarket'::public.store_subtype, true),
    (new.id, 'Atacadão', 'physical'::public.store_type, 'supermarket'::public.store_subtype, true),
    (new.id, 'Cometa', 'physical'::public.store_type, 'supermarket'::public.store_subtype, true),
    (new.id, 'São Luiz', 'physical'::public.store_type, 'supermarket'::public.store_subtype, true),
    (new.id, 'Nidobox', 'physical'::public.store_type, 'supermarket'::public.store_subtype, true)
  on conflict do nothing;

  return new;
end;
$$;

-- Backfill default stores for existing users
insert into public.stores (user_id, name, store_type, store_subtype, is_default)
select u.id, s.name, s.store_type, s.store_subtype, true
from auth.users u
cross join (
  values
    ('Amazon', 'online'::public.store_type, null::public.store_subtype),
    ('Shopee', 'online'::public.store_type, null::public.store_subtype),
    ('AliExpress', 'online'::public.store_type, null::public.store_subtype),
    ('Mercado Livre', 'online'::public.store_type, null::public.store_subtype),
    ('Assaí', 'physical'::public.store_type, 'supermarket'::public.store_subtype),
    ('Pão de Açúcar', 'physical'::public.store_type, 'supermarket'::public.store_subtype),
    ('Atacadão', 'physical'::public.store_type, 'supermarket'::public.store_subtype),
    ('Cometa', 'physical'::public.store_type, 'supermarket'::public.store_subtype),
    ('São Luiz', 'physical'::public.store_type, 'supermarket'::public.store_subtype),
    ('Nidobox', 'physical'::public.store_type, 'supermarket'::public.store_subtype)
) as s(name, store_type, store_subtype)
on conflict do nothing;
