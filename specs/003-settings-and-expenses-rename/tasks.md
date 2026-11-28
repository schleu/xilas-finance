# Tarefas 003 — Renomeação para Despesas e Configurações Gerais

Cada tarefa cabe em um PR pequeno. `[P]` = pode rodar em paralelo. `Dep:` = depende de.

## Fase 1 — Banco de dados e RLS (US-3, US-4)

- [ ] **T-01 Migração `stores`, `banks`, FKs em `bills`/`recurring_rules`, RLS e seed de lojas padrão.** Criar tabelas com constraints de débito em conta e dia de vencimento do cartão, políticas RLS por `user_id`, atualizar `handle_new_user()` com as lojas Online e Supermercados padrão e fazer backfill idempotente. *Pronto:* teste pgTAP de isolamento/checks e `securityAudit.test.ts` verde.

## Fase 2 — Renomeação e Estrutura de Configurações (US-1, US-2)

- [ ] **T-02 Renomear "Contas" para "Despesas" na UI e rotas.** Atualizar navegação, rota `/despesas` (com redirect de `/contas`), títulos, botões, cards e mensagens de gastos para "Despesas". *Pronto:* critérios da US-1 e suíte de testes atualizada verde.
- [ ] **T-03 Página unificada `/configuracoes` com submenu interno.** Criar `SettingsPage` com submenu (`Categorias`, `Lojas`, `Bancos`), integrar `CategoriesPage` na aba Categorias e redirecionar `/categorias` → `/configuracoes?aba=categorias`. *Dep:* T-02. *Pronto:* critérios da US-2 testados.

## Fase 3 — CRUD de Lojas e Bancos + Integração nas Despesas (US-3, US-4)

- [ ] **T-04 [P] Feature Lojas (`stores`): schema Zod, hooks e aba Lojas em Configurações.** Implementar CRUD de lojas (Online e Física/Supermercados), unicidade case-insensitive e agrupamento na UI. *Dep:* T-01, T-03. *Pronto:* testes unitários e de componente cobrindo US-3.
- [ ] **T-05 [P] Feature Bancos (`banks`): schema Zod, hooks e aba Bancos em Configurações.** Implementar CRUD de bancos com toggles de débito em conta (agência/conta mascaradas) e cartão de crédito (dia de vencimento 1–31). *Dep:* T-01, T-03. *Pronto:* testes unitários e de componente cobrindo US-4.
- [ ] **T-06 Integrar seletores de Lojas e Bancos no formulário de Despesas (`BillForm`).** Permitir escolher loja cadastrada, banco com débito em conta (preenchendo agência/conta automaticamente) e banco com cartão de crédito (sugerindo vencimento), mantendo compatibilidade com registros antigos. *Dep:* T-04, T-05. *Pronto:* testes de componente e `npm run check` verde.
