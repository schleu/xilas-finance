-- Supermarket payment methods, nfe_url, bill_items table with RLS, and Supermercado category seed (007 / T-01)

create type public.supermarket_payment_method as enum (
  'credit',
  'debit_card',
  'food_voucher',
  'meal_voucher',
  'pix',
  'cash'
);

create type public.bill_item_category as enum (
  'food',
  'cleaning',
  'hygiene',
  'beverages',
  'produce',
  'bakery_butcher',
  'other'
);

create type public.bill_item_unit as enum (
  'un',
  'kg',
  'g',
  'l',
  'ml',
  'pct'
);

alter table public.bills
  add column supermarket_payment_method public.supermarket_payment_method,
  add column nfe_url text;

create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  description text not null check (char_length(btrim(description)) between 1 and 160),
  item_category public.bill_item_category not null default 'other',
  quantity numeric(10, 3) not null check (quantity > 0),
  unit public.bill_item_unit not null default 'un',
  unit_price_cents integer not null check (unit_price_cents > 0),
  total_cents integer not null check (total_cents > 0),
  created_at timestamptz not null default now()
);

create index bill_items_bill_id_idx on public.bill_items (bill_id);
create index bill_items_user_id_idx on public.bill_items (user_id);

alter table public.bill_items enable row level security;

create policy "bill_items_select_own"
  on public.bill_items for select to authenticated
  using (user_id = (select auth.uid()));

create policy "bill_items_insert_own"
  on public.bill_items for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.bills b
      where b.id = bill_id and b.user_id = (select auth.uid())
    )
  );

create policy "bill_items_update_own"
  on public.bill_items for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "bill_items_delete_own"
  on public.bill_items for delete to authenticated
  using (user_id = (select auth.uid()));

-- Update handle_new_user to include Supermercado default category
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
    (new.id, 'Cartão de Crédito', true),
    (new.id, 'Supermercado', true)
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

-- Backfill Supermercado category for existing users
insert into public.categories (user_id, name, is_default)
select u.id, 'Supermercado', true
from auth.users u
on conflict do nothing;
