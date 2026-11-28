# Tarefas 012 — Layout de Despesas e Rendas (Modais, Tabelas Ordenáveis, Autocomplete e Ícones)

Cada tarefa cabe em um PR pequeno. `[P]` = pode rodar em paralelo. `Dep:` = depende de.
Formato obrigatório: `- [ ] **T-NN Título.** Descrição. *Dep:* T-XX. *Pronto:* critério verificável.`

## Fase 0 — Fundação (UI primitives e utilitários)

- [x] **T-01 Adicionar componentes UI base (Dialog, Tooltip, Table).** Criar `src/components/ui/dialog.tsx`, `src/components/ui/tooltip.tsx` e `src/components/ui/table.tsx` com `radix-ui` e adicionar `TooltipProvider` no root. *Pronto:* componentes acessíveis com suporte a teclado/Escape e `npm run typecheck` verde.
- [x] **T-02 Utilitários de ordenação de tabela e normalização decimal `.` → `,`.** `[P]` Criar `src/lib/tableSort.ts` e adicionar `normalizeDecimalInput` em `src/lib/money.ts` com testes unitários. *Pronto:* testes em `src/lib/money.test.ts` e `src/lib/tableSort.test.ts` verdes.

## Fase 1 — Despesas (US-1 e US-2)

- [x] **T-03 Atualizar `BillForm` com autocomplete Empresa/Loja, vencimento padrão hoje e valor `.` → `,`.** Remover o campo "Loja cadastrada", adicionar autocomplete em "Empresa / Loja" vinculando `store_id`, definir `todayIsoFortaleza()` como default de vencimento em novas despesas e aplicar conversão `.` → `,` no campo Valor. *Dep:* T-02. *Pronto:* critérios da US-1 verificados em `BillForm.test.tsx`.
- [x] **T-04 Redesign de `BillsPage` (modais, tabela ordenável, filtros em modal e ícones com tooltip).** Exibir formulários (criar/editar), importação e filtros em modais; adicionar botão "Limpar filtros"; trocar lista por tabela com colunas ordenáveis; converter ações "Marcar como pago", "Editar" e "Excluir" em ícones com tooltip. *Dep:* T-01, T-02, T-03. *Pronto:* critérios da US-2 verificados em `BillsPage.test.tsx`.

## Fase 2 — Rendas (US-3)

- [x] **T-05 Redesign de `IncomesPage` com paridade visual de Despesas.** Exibir formulário (criar/editar com conversão `.` → `,`), importação e filtros em modais; adicionar botão "Limpar filtros"; trocar lista por tabela com colunas ordenáveis; converter ações "Editar" e "Excluir" em ícones com tooltip. *Dep:* T-01, T-02. *Pronto:* critérios da US-3 verificados em `IncomesPage.test.tsx` e `npm run check` verde.
