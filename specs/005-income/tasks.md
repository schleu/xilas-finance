# Tarefas 005 — Área de Renda

Cada tarefa cabe em um PR pequeno. `[P]` = pode rodar em paralelo. `Dep:` = depende de.

## Fase 1 — Banco de dados e RLS (US-1, US-2)

- [x] **T-01 Migração `income_types`, `incomes`, `monthly_income_summary()` e RLS.** Criar enum `income_nature`, tabelas, índices, políticas RLS, função de resumo mensal e seed/backfill dos tipos padrão (`Salário`, `Freela`, `Outros`). *Pronto:* teste pgTAP provando isolamento por usuário e agregação correta.

## Fase 2 — CRUD de Rendas e Homepage (US-1, US-2)

- [x] **T-02 Schemas Zod, API e hooks TanStack Query de rendas e tipos de renda.** Implementar `incomeSchema`, `incomeTypeSchema` e hooks em `src/features/incomes/`. *Dep:* T-01. *Pronto:* testes unitários dos schemas.
- [x] **T-03 Tela `/rendas` com CRUD completo e gestão de tipos de renda.** Criar formulário (descrição, valor BRL, data, natureza fixa/variável, tipo, banco depositado), lista com filtros e gerenciamento de tipos customizados. *Dep:* T-02. *Pronto:* testes de componente cobrindo US-1.
- [x] **T-04 Cards de Total de Rendas e Saldo do mês na Homepage.** Integrar `monthly_income_summary` em `DashboardPage` exibindo Total de Rendas e Saldo (`Rendas − Despesas pagas`). *Dep:* T-02. *Pronto:* testes de componente cobrindo US-2.

## Fase 3 — Cadastro de renda pelo chat (US-3)

- [x] **T-05 Ferramenta `propose_income` e `IncomeProposalCard` no chat.** Expor `propose_income` em `api/_llm/tools.ts` (validada pelo mesmo `incomeSchema`, sem dados bancários sensíveis) e cartão de confirmação na `ChatPage` com invalidação de cache. *Dep:* T-02, T-04. *Pronto:* testes unitários e de componente cobrindo US-3 e `npm run check` verde.
