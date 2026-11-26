-- Recurring rules, bills.recurring_rule_id link, idempotent generator, and pg_cron (T-16 / US-2b)

create table public.recurring_rules (
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
  due_day smallint not null check (due_day between 1 and 31),
  start_month date not null check (start_month = date_trunc('month', start_month)::date),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_rules_debit_requires_bank_details check (
    payment_type <> 'debit'
    or (
      nullif(btrim(coalesce(bank, '')), '') is not null
      and nullif(btrim(coalesce(agency, '')), '') is not null
      and nullif(btrim(coalesce(account_number, '')), '') is not null
    )
  ),
  constraint recurring_rules_non_debit_clears_bank_details check (
    payment_type = 'debit'
    or (bank is null and agency is null and account_number is null)
  )
);

create index recurring_rules_user_id_active_idx
  on public.recurring_rules (user_id, active);

create trigger recurring_rules_set_updated_at
  before update on public.recurring_rules
  for each row
  execute function public.set_updated_at();

alter table public.recurring_rules enable row level security;

create policy "recurring_rules_select_own"
  on public.recurring_rules
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "recurring_rules_insert_own"
  on public.recurring_rules
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

create policy "recurring_rules_update_own"
  on public.recurring_rules
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

create policy "recurring_rules_delete_own"
  on public.recurring_rules
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Link bills to recurring_rules with idempotency unique constraint
alter table public.bills
  add column recurring_rule_id uuid references public.recurring_rules (id) on delete set null;

alter table public.bills
  add constraint bills_recurring_rule_due_date_key unique (recurring_rule_id, due_date);

create index bills_recurring_rule_id_idx
  on public.bills (recurring_rule_id)
  where recurring_rule_id is not null;

-- Idempotent generator: ensures pending bills for current month + next 2 months
-- Runs as SECURITY INVOKER:
--   - When invoked via RPC by authenticated user, RLS scopes to that user's rules/bills.
--   - When invoked by pg_cron as postgres, processes all users' active rules.
create or replace function public.generate_recurring_bills(
  p_reference_date date default null,
  p_rule_id uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ref_month date;
  v_inserted_count integer := 0;
begin
  v_ref_month := date_trunc(
    'month',
    coalesce(p_reference_date, (now() at time zone 'America/Fortaleza')::date)
  )::date;

  with target_months as (
    select (v_ref_month + make_interval(months => offset_m))::date as month_start
    from generate_series(0, 2) as offset_m
  ),
  candidates as (
    select
      r.user_id,
      r.description,
      r.company,
      r.category_id,
      r.amount_cents,
      r.payment_type,
      r.bank,
      r.agency,
      r.account_number,
      make_date(
        extract(year from tm.month_start)::integer,
        extract(month from tm.month_start)::integer,
        least(
          r.due_day::integer,
          extract(day from ((tm.month_start + interval '1 month') - interval '1 day'))::integer
        )
      ) as due_date,
      r.id as recurring_rule_id
    from public.recurring_rules r
    cross join target_months tm
    where r.active = true
      and tm.month_start >= r.start_month
      and (p_rule_id is null or r.id = p_rule_id)
  ),
  inserted as (
    insert into public.bills (
      user_id,
      description,
      company,
      category_id,
      amount_cents,
      payment_type,
      bank,
      agency,
      account_number,
      due_date,
      status,
      paid_at,
      recurring_rule_id
    )
    select
      c.user_id,
      c.description,
      c.company,
      c.category_id,
      c.amount_cents,
      c.payment_type,
      c.bank,
      c.agency,
      c.account_number,
      c.due_date,
      'pending'::public.bill_status,
      null,
      c.recurring_rule_id
    from candidates c
    on conflict (recurring_rule_id, due_date) do nothing
    returning id
  )
  select count(*)::integer into v_inserted_count from inserted;

  return v_inserted_count;
end;
$$;

revoke all on function public.generate_recurring_bills(date, uuid) from public, anon;
grant execute on function public.generate_recurring_bills(date, uuid) to authenticated;

-- Schedule daily generation via pg_cron when extension is available (03:05 UTC = 00:05 America/Fortaleza)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;

  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'generate-recurring-bills-daily';

    perform cron.schedule(
      'generate-recurring-bills-daily',
      '5 3 * * *',
      'select public.generate_recurring_bills();'
    );
  end if;
end;
$$;
