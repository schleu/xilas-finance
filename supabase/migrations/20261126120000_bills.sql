-- Bills table, enums, constraints, indexes, updated_at trigger, and RLS (T-08)

create type public.payment_type as enum ('pix', 'credit', 'debit');
create type public.bill_status as enum ('pending', 'paid');

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  description text not null check (char_length(btrim(description)) between 1 and 120),
  company text,
  category_id uuid not null references public.categories (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  payment_type public.payment_type not null,
  bank text,
  agency text,
  account_number text,
  due_date date not null,
  status public.bill_status not null default 'pending',
  paid_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bills_debit_requires_bank_details check (
    payment_type <> 'debit'
    or (
      nullif(btrim(coalesce(bank, '')), '') is not null
      and nullif(btrim(coalesce(agency, '')), '') is not null
      and nullif(btrim(coalesce(account_number, '')), '') is not null
    )
  ),
  constraint bills_non_debit_clears_bank_details check (
    payment_type = 'debit'
    or (bank is null and agency is null and account_number is null)
  ),
  constraint bills_paid_at_requires_paid_status check (
    status = 'paid' or paid_at is null
  )
);

create index bills_user_id_due_date_idx
  on public.bills (user_id, due_date);

create index bills_user_id_category_id_idx
  on public.bills (user_id, category_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bills_set_updated_at
  before update on public.bills
  for each row
  execute function public.set_updated_at();

alter table public.bills enable row level security;

create policy "bills_select_own"
  on public.bills
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "bills_insert_own"
  on public.bills
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.categories c
      where c.id = category_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "bills_update_own"
  on public.bills
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.categories c
      where c.id = category_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "bills_delete_own"
  on public.bills
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
