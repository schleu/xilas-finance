# Plano técnico 009 — Mês/Ano de Referência nas Despesas

Deriva de `spec.md` e `specs/constitution.md`.

## 1. Arquitetura e decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Tipo da coluna | `reference_month date not null` armazenando sempre o dia `01` (`YYYY-MM-01`), validado por `CHECK (extract(day from reference_month) = 1)`. | Consistente com `recurring_rules.start_month` e com os argumentos `date` dos RPCs mensais. |
| Fallback no banco e no schema | Normalizar/derivar de `due_date` tanto no `billSchema` (Zod) quanto via trigger `BEFORE INSERT OR UPDATE` em `public.bills`. | Garante consistência mesmo em inserções diretas, recorrências ou importações. |
| Relatórios e filtros | Atualizar `listBills` e os RPCs `monthly_summary`, `spending_by_category`, `monthly_evolution` para filtrar por `reference_month`. | Atende à regra de competência confirmada mantendo `overdue_count` baseado em `due_date`. |

## 2. Modelo de dados

Migração `supabase/migrations/20261128100000_bills_reference_month.sql`:
- `alter table public.bills add column reference_month date;`
- Backfill: `update public.bills set reference_month = date_trunc('month', due_date)::date where reference_month is null;`
- Trigger `bills_set_reference_month` (`before insert or update`): se `new.reference_month is null`, usa `date_trunc('month', new.due_date)::date`; caso contrário trunca para o primeiro dia do mês.
- `alter table public.bills alter column reference_month set not null;`
- Constraint `bills_reference_month_first_day check (extract(day from reference_month) = 1)`.
- Índice `bills_user_id_reference_month_idx on public.bills (user_id, reference_month)`.
- Atualização dos RPCs `monthly_summary`, `spending_by_category`, `monthly_evolution` e `generate_recurring_bills`.

## 3. Segurança (RLS)

- Políticas RLS existentes de `public.bills` protegem a nova coluna.
- Novo teste SQL em `supabase/tests/09_bills_reference_month.sql` validando fallback, competência nos RPCs e isolamento entre usuários.

## 4. Contratos (API, funções, ferramentas)

- `billSchema` (`src/features/bills/schemas/billSchema.ts`): aceita `reference_month` opcional (`"YYYY-MM"`, `"YYYY-MM-DD"`, `""` ou `null`), normalizando para `"YYYY-MM-01"` ou derivando de `due_date`.
- `listBills({ month })`: filtra `reference_month = "${month}-01"`.

## 5. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Despesas existentes sem `reference_month` | Backfill obrigatório na mesma migração antes de aplicar `NOT NULL`. |

## 6. Mapeamento spec → plano

| Spec | Onde é atendida |
|---|---|
| US-1 | `supabase/migrations/20261128100000_bills_reference_month.sql`, `src/features/bills/schemas/billSchema.ts`, `src/features/bills/api/billsApi.ts`, `src/features/bills/components/BillForm.tsx` |
