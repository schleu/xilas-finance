# Spec 009 — Mês/Ano de Referência nas Despesas

**Status:** implementada · **Versão:** 0.1 · **Foco:** o quê e por quê (sem decisões de implementação)

## Objetivo

Permitir informar opcionalmente o **mês/ano de referência** (`reference_month`) de cada despesa para acompanhar a competência correta dos gastos (ex.: fatura que vence no mês seguinte mas refere-se ao mês anterior), assumindo automaticamente o mês/ano do vencimento quando o campo não for preenchido.

## Escopo

**Dentro:**
- Coluna `reference_month` em `public.bills` com backfill automático a partir de `due_date`.
- Fallback automático para o mês/ano de `due_date` quando `reference_month` não for informado na criação ou edição.
- Campo opcional "Mês/Ano de referência" no formulário de despesas e exibição na listagem.
- Filtro mensal de Despesas e funções de resumo/gráficos da Homepage agrupando por `reference_month`.

**Fora:**
- Alteração da regra de cálculo de "Atrasado" (permanece baseada em `due_date < hoje` e `status = 'pending'`).
- Mês de referência em Rendas (rendas seguem `received_date`).

## US-1 — Competência mensal das despesas

Como usuário, quero informar opcionalmente o mês/ano de referência de uma despesa e ver os filtros e gráficos mensais respeitando essa competência.

**Critérios de aceite**
- [ ] Todas as despesas existentes passam a ter `reference_month` preenchido com o primeiro dia do mês de `due_date`.
- [ ] Ao cadastrar ou editar uma despesa deixando o campo "Mês/Ano de referência" vazio, o sistema grava automaticamente o mês/ano da data de vencimento (`due_date`).
- [ ] Ao informar manualmente um mês/ano de referência diferente do vencimento, o valor informado é preservado e exibido na tela de Despesas (ex.: `12/2026`).
- [ ] O filtro por mês na tela de Despesas filtra por `reference_month`.
- [ ] Os resumos e gráficos mensais da Homepage (`monthly_summary`, `spending_by_category`, `monthly_evolution`) agrupam despesas por `reference_month`, mantendo o contador de atrasados baseado em `due_date < hoje`.
- [ ] Despesas geradas por recorrência (`generate_recurring_bills`) preenchem `reference_month` com o mês do vencimento gerado.

## Requisitos não funcionais

- **Privacidade/segurança:** `reference_month` herda integralmente as políticas RLS de `public.bills`; RPCs continuam `SECURITY INVOKER`.

## Histórico

- 0.1 — Rascunho inicial separado da proposta unificada (com premissa de competência confirmada pelo usuário).
