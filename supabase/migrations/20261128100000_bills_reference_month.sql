-- Reference month on bills + reporting RPCs updated to group by reference_month (Spec 009 / T-01)

alter table public.bills
  add column if not exists reference_month date;

update public.bills
set reference_month = date_trunc('month', due_date)::date
where reference_month is null;

create or replace function public.set_bill_reference_month()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.reference_month is null then
    new.reference_month := date_trunc('month', new.due_date)::date;
  else
    new.reference_month := date_trunc('month', new.reference_month)::date;
  end if;
  return new;
end;
$$;

drop trigger if exists bills_set_reference_month on public.bills;
create trigger bills_set_reference_month
  before insert or update on public.bills
  for each row
  execute function public.set_bill_reference_month();

alter table public.bills
  alter column reference_month set not null;

alter table public.bills
  drop constraint if exists bills_reference_month_first_day;

alter table public.bills
  add constraint bills_reference_month_first_day
  check (extract(day from reference_month) = 1);

create index if not exists bills_user_id_reference_month_idx
  on public.bills (user_id, reference_month);

-- Update reporting RPCs to group by reference_month while keeping overdue based on due_date
create or replace function public.monthly_summary(
  p_month date default null,
  p_today date default null
)
returns table (
  month date,
  paid_total_cents bigint,
  pending_total_cents bigint,
  overdue_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      date_trunc(
        'month',
        coalesce(p_month, (now() at time zone 'America/Fortaleza')::date)
      )::date as month_start,
      coalesce(p_today, (now() at time zone 'America/Fortaleza')::date) as today_date
  )
  select
    p.month_start as month,
    coalesce(sum(b.amount_cents) filter (where b.status = 'paid'), 0)::bigint as paid_total_cents,
    coalesce(sum(b.amount_cents) filter (where b.status = 'pending'), 0)::bigint as pending_total_cents,
    count(*) filter (where b.status = 'pending' and b.due_date < p.today_date)::integer as overdue_count
  from params p
  left join public.bills b
    on b.reference_month = p.month_start
  group by p.month_start;
$$;

create or replace function public.spending_by_category(
  p_from date,
  p_to date
)
returns table (
  category_id uuid,
  category_name text,
  paid_total_cents bigint,
  bills_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id as category_id,
    c.name as category_name,
    sum(b.amount_cents)::bigint as paid_total_cents,
    count(*)::integer as bills_count
  from public.bills b
  join public.categories c
    on c.id = b.category_id
  where b.status = 'paid'
    and b.reference_month >= date_trunc('month', p_from)::date
    and b.reference_month <= date_trunc('month', p_to)::date
  group by c.id, c.name
  order by paid_total_cents desc, c.name asc;
$$;

create or replace function public.monthly_evolution(
  p_months integer default 6,
  p_end_month date default null
)
returns table (
  month date,
  paid_total_cents bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_end_month date;
  v_start_month date;
begin
  if p_months is null or p_months < 1 or p_months > 60 then
    raise exception 'p_months must be between 1 and 60'
      using errcode = '22023';
  end if;

  v_end_month := date_trunc(
    'month',
    coalesce(p_end_month, (now() at time zone 'America/Fortaleza')::date)
  )::date;
  v_start_month := (v_end_month - make_interval(months => p_months - 1))::date;

  return query
  select
    gs.month::date as month,
    coalesce(sum(b.amount_cents), 0)::bigint as paid_total_cents
  from generate_series(v_start_month, v_end_month, interval '1 month') as gs(month)
  left join public.bills b
    on b.status = 'paid'
   and b.reference_month = gs.month::date
  group by gs.month
  order by gs.month asc;
end;
$$;

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
      tm.month_start as reference_month,
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
      reference_month,
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
      c.reference_month,
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
