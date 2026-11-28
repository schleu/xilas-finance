# Plano técnico 003 — Renomeação para Despesas e Configurações Gerais

Deriva de `spec.md` v0.1 e `specs/constitution.md`.

## 1. Arquitetura e decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Renomeação UI | Atualizar textos de "Contas" → "Despesas", rota principal `/despesas` e `<Navigate to="/despesas" replace />` em `/contas` | Evita quebra de links antigos e separa "Despesas" de "Bancos/Contas bancárias" |
| Configurações | Nova feature `src/features/settings/` com `SettingsPage` em `/configuracoes` usando query param `?aba=categorias\|lojas\|bancos` | Submenu compartilhável por URL e redirect limpo de `/categorias` |
| Lojas | Nova feature `src/features/stores/{api,components,hooks,schemas}` + tabela `public.stores` | Permite reutilização no formulário de despesas, no chat (`004`) e em supermercados (`007`) |
| Bancos | Nova feature `src/features/banks/{api,components,hooks,schemas}` + tabela `public.banks` | Unifica débito em conta (agência/conta) e cartão de crédito (dia de vencimento) em uma única entidade |
| Compatibilidade `bills` | Adicionar `store_id` e `bank_id` (nullable, `on delete set null`) em `bills` e `recurring_rules`, mantendo `company`, `bank`, `agency`, `account_number` | Preserva constraints da `001-core` e histórico em caso de exclusão de loja/banco |

## 2. Modelo de dados

```sql
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
  check (not has_debit_account or (agency is not null and account_number is not null)),
  check (not has_credit_card or credit_card_due_day is not null)
);

create index banks_user_id_idx on public.banks (user_id);

alter table public.bills
  add column store_id uuid references public.stores (id) on delete set null,
  add column bank_id uuid references public.banks (id) on delete set null;

alter table public.recurring_rules
  add column store_id uuid references public.stores (id) on delete set null,
  add column bank_id uuid references public.banks (id) on delete set null;
```

- Atualizar `handle_new_user()` para semear as 4 lojas Online (`Amazon`, `Shopee`, `AliExpress`, `Mercado Livre`) e os 6 Supermercados físicos (`Assaí`, `Pão de Açúcar`, `Atacadão`, `Cometa`, `São Luiz`, `Nidobox`), mais backfill idempotente para usuários já existentes.

## 3. Segurança (RLS)

- RLS habilitada em `stores` e `banks` com políticas `select`, `insert`, `update`, `delete` restritas a `user_id = (select auth.uid())`.
- Teste pgTAP em `supabase/tests/05_stores_banks_rls.sql` cobrindo isolamento entre usuários e checks de débito/crédito.
- Auditoria de segurança (`api/securityAudit.test.ts`) garante que `agency`/`account_number` de `banks` nunca vão para logs ou LLM.

## 4. Contratos (API, funções, ferramentas)

- Schemas Zod: `storeSchema` e `bankSchema` (com `.superRefine` espelhando as checks do Postgres).
- Hooks TanStack Query: `useStores`, `useCreateStore`, `useUpdateStore`, `useDeleteStore`; `useBanks`, `useCreateBank`, `useUpdateBank`, `useDeleteBank`.
- `BillForm` integra seletores opcionais de `Lojas` e `Bancos` (filtrando bancos com débito em conta quando `payment_type = debit`, e bancos com cartão de crédito quando `payment_type = credit`).

## 5. Riscos e mitigações

- **Testes existentes procurando texto "Contas":** atualizar testes afetados na mesma tarefa da renomeação (T-02) mantendo `npm run check` 100% verde.

## 6. Mapeamento spec → plano

| Spec | Onde é atendida |
|---|---|
| US-1 | Rotas `/despesas` (+ redirect `/contas`) e textos pt-BR em `AppLayout`, `DashboardPage`, `BillsPage`, `BillForm` e `ChatPage` |
| US-2 | `src/features/settings/components/SettingsPage.tsx` + submenu + redirect `/categorias` |
| US-3 | Migração `stores` + seed defaults + `src/features/stores/` + integração no `BillForm` |
| US-4 | Migração `banks` + `src/features/banks/` + integração no `BillForm` |
