# Plano técnico 005 — Área de Renda

Deriva de `spec.md` v0.1 e `specs/constitution.md`.

## 1. Arquitetura e decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Feature | Nova pasta `src/features/incomes/{api,components,hooks,schemas}` e rota `/rendas` | Separação limpa por domínio conforme constituição |
| Tipos de renda | Tabela `public.income_types` com seed padrão (`Salário`, `Freela`, `Outros`) | Permite ao usuário cadastrar novos tipos com unicidade case-insensitive |
| Leitura da Homepage | Nova função SQL `monthly_income_summary(p_month date)` (ou extensão de `monthly_summary`) | Mantém cálculos agregados no Postgres e consistentes entre Homepage e chat |
| Chat | Nova ferramenta `propose_income` em `api/_llm/tools.ts` + cartão `IncomeProposalCard` | Reutiliza o mesmo fluxo "LLM propõe, usuário confirma" da `001-core` |

## 2. Modelo de dados

```sql
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
```

- Função SQL `monthly_income_summary(p_month date)` retornando `total_income_cents bigint` para o usuário autenticado.
- Atualizar `handle_new_user()` para semear `Salário`, `Freela` e `Outros` + backfill idempotente.

## 3. Segurança (RLS)

- RLS habilitada em `income_types` e `incomes` com políticas `select`, `insert`, `update`, `delete` restritas a `user_id = (select auth.uid())`.
- Teste pgTAP em `supabase/tests/07_incomes_rls.sql`.

## 4. Contratos (API, funções, ferramentas)

- Schemas Zod compartilhados: `incomeSchema` e `incomeTypeSchema`.
- Hooks TanStack Query: `useIncomes`, `useCreateIncome`, `useUpdateIncome`, `useDeleteIncome`, `useIncomeTypes`, `useMonthlyIncomeSummary`.
- Ferramenta do chat `propose_income` retorna `{ toolOutput, proposedIncome }` sem gravar no banco; `ChatPage` renderiza `IncomeProposalCard` e grava pelo hook `useCreateIncome` após confirmação.

## 5. Riscos e mitigações

- **Exclusão de tipo de renda em uso:** bloqueada pela FK no banco e tratada na UI com mensagem amigável (mesmo padrão de Categorias).

## 6. Mapeamento spec → plano

| Spec | Onde é atendida |
|---|---|
| US-1 | Migração `income_types`/`incomes` + `src/features/incomes/` + rota `/rendas` |
| US-2 | `monthly_income_summary` + novos cards em `DashboardPage` |
| US-3 | `propose_income` em `api/_llm/tools.ts` + `IncomeProposalCard` em `ChatPage` |
