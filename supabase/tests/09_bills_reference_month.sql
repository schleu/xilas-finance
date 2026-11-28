-- Verify bills.reference_month fallback, competence grouping, and RLS isolation (Spec 009)
begin;

do $$
declare
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_cat_a uuid;
  v_bill_auto date;
  v_bill_explicit date;
  v_paid_dec bigint;
  v_other_count integer;
begin
  insert into auth.users (id, email) values (v_user_a, 'ref_a@example.com'), (v_user_b, 'ref_b@example.com');
  select id into v_cat_a from public.categories where user_id = v_user_a limit 1;

  -- Act as User A
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. Omitting reference_month derives from due_date
  insert into public.bills (description, category_id, amount_cents, payment_type, due_date, status)
  values ('Conta auto', v_cat_a, 10000, 'pix', '2026-12-15', 'pending')
  returning reference_month into v_bill_auto;

  if v_bill_auto <> '2026-12-01'::date then
    raise exception 'Expected derived reference_month 2026-12-01, got %', v_bill_auto;
  end if;

  -- 2. Explicit reference_month (bill due Jan 2027 referring to Dec 2026)
  insert into public.bills (description, category_id, amount_cents, payment_type, due_date, reference_month, status, paid_at)
  values ('Fatura cartão', v_cat_a, 25000, 'credit', '2027-01-10', '2026-12-01', 'paid', '2027-01-09')
  returning reference_month into v_bill_explicit;

  if v_bill_explicit <> '2026-12-01'::date then
    raise exception 'Expected explicit reference_month 2026-12-01, got %', v_bill_explicit;
  end if;

  select paid_total_cents into v_paid_dec from public.monthly_summary('2026-12-01', '2026-12-20');
  if v_paid_dec <> 25000 then
    raise exception 'Expected Dec 2026 paid_total_cents 25000, got %', v_paid_dec;
  end if;

  -- 3. Act as User B: must not see User A bills
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  select count(*) into v_other_count from public.bills where reference_month = '2026-12-01';
  if v_other_count <> 0 then
    raise exception 'RLS violation: User B saw % bills from User A', v_other_count;
  end if;
end;
$$;

rollback;
