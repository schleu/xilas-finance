# Tarefas 009 — Mês/Ano de Referência nas Despesas

Cada tarefa cabe em um PR pequeno. `[P]` = pode rodar em paralelo. `Dep:` = depende de.
Formato obrigatório: `- [ ] **T-NN Título.** Descrição. *Dep:* T-XX. *Pronto:* critério verificável.`

## Fase 1 — Banco de dados e RPCs

- [x] **T-01 Adicionar coluna `reference_month` em `bills` e atualizar RPCs mensais.** Criar migração SQL com backfill, trigger de fallback para `due_date`, constraint, índice e atualização de `monthly_summary`, `spending_by_category`, `monthly_evolution` e `generate_recurring_bills`, mais teste SQL em `supabase/tests/`. *Pronto:* migração válida e teste SQL cobrindo fallback, competência e isolamento RLS.

## Fase 2 — Schema, API e formulário

- [x] **T-02 Integrar `reference_month` no schema, API e `BillForm`.** Atualizar `billSchema.ts`, `billsApi.ts` (filtro mensal por `reference_month`) e adicionar campo opcional "Mês/Ano de referência" em `BillForm.tsx`. *Dep:* T-01. *Pronto:* critérios da US-1 verificados em `billSchema.test.ts`, `BillForm.test.tsx` e `npm run check` verde.
