-- Incomes and income_types schema, RLS, monthly_income_summary() and default seeds (005 / T-01)

create type public.income_nature as enum ('fixed', 'variable');

create table public.income_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index income_types_user_id_lower_name_key
  on public.income_types (user_id, lower(btrim(name)));

alter table public.income_types enable row level security;

create policy "income_types_select_own"
  on public.income_types for select to authenticated
  using (user_id = (select auth.uid()));

create policy "income_types_insert_own"
  on public.income_types for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "income_types_update_own"
  on public.income_types for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "income_types_delete_own"
  on public.income_types for delete to authenticated
  using (user_id = (select auth.uid()));

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  description text not null check (char_length(btrim(description)) between 1 and 120),
  amount_cents integer not null check (amount_cents > 0),
  received_date date not null,
  nature public.income_nature not null,
  income_type_id uuid not null references public.income_types (id),
  bank_id uuid references public.banks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index incomes_user_date_idx on public.incomes (user_id, received_date desc);

alter table public.incomes enable row level security;

create policy "incomes_select_own"
  on public.incomes for select to authenticated
  using (user_id = (select auth.uid()));

create policy "incomes_insert_own"
  on public.incomes for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "incomes_update_own"
  on public.incomes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "incomes_delete_own"
  on public.incomes for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.monthly_income_summary(p_month date)
returns table (
  month date,
  total_income_cents bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      date_trunc('month', p_month)::date as month_start,
      (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date as month_end
  )
  select
    b.month_start as month,
    coalesce(sum(i.amount_cents), 0)::bigint as total_income_cents
  from bounds b
  left join public.incomes i
    on i.user_id = (select auth.uid())
   and i.received_date between b.month_start and b.month_end
  group by b.month_start;
$$;

grant execute on function public.monthly_income_summary(date) to authenticated;

-- Update handle_new_user to include default income types
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

  insert into public.income_types (user_id, name, is_default)
  values
    (new.id, 'Salário', true),
    (new.id, 'Freela', true),
    (new.id, 'Outros', true)
  on conflict do nothing;

  return new;
end;
$$;

-- Backfill default income types for existing users
insert into public.income_types (user_id, name, is_default)
select u.id, t.name, true
from auth.users u
cross join (values ('Salário'), ('Freela'), ('Outros')) as t(name)
on conflict do nothing;
