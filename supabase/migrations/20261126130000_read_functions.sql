-- Read-only reporting functions for homepage and chatbot (T-12)
-- All functions run as SECURITY INVOKER so RLS on bills/categories is always enforced.
-- Reference month is always bills.due_date (spec 001-core glossary).
-- Today's date defaults to America/Fortaleza (constitution conventions).

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
    on b.due_date >= p.month_start
   and b.due_date < (p.month_start + interval '1 month')::date
  group by p.month_start;
$$;

revoke all on function public.monthly_summary(date, date) from public, anon;
grant execute on function public.monthly_summary(date, date) to authenticated;

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
    and b.due_date >= p_from
    and b.due_date <= p_to
  group by c.id, c.name
  order by paid_total_cents desc, c.name asc;
$$;

revoke all on function public.spending_by_category(date, date) from public, anon;
grant execute on function public.spending_by_category(date, date) to authenticated;

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
   and b.due_date >= gs.month::date
   and b.due_date < (gs.month::date + interval '1 month')::date
  group by gs.month
  order by gs.month asc;
end;
$$;

revoke all on function public.monthly_evolution(integer, date) from public, anon;
grant execute on function public.monthly_evolution(integer, date) to authenticated;
