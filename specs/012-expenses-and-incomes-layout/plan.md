# Plano técnico 012 — Layout de Despesas e Rendas (Modais, Tabelas Ordenáveis, Autocomplete e Ícones)

Deriva de `spec.md` e `specs/constitution.md`.

## 1. Arquitetura e decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Primitivos shadcn/ui | Criar `src/components/ui/dialog.tsx`, `src/components/ui/tooltip.tsx` e `src/components/ui/table.tsx` com `radix-ui` (já presente no `package.json`) e envolver o app com `TooltipProvider`. | Garante acessibilidade (ARIA, focus trap, hover+focus tooltip) e reutilização em Despesas, Rendas e Configurações. |
| Conversão `.` → `,` | Adicionar `normalizeDecimalInput(raw: string): string` em `src/lib/money.ts` e adaptar `parseBRLToCents` para aceitar decimal com `.` quando não há `,` e há 1–2 dígitos após o único ponto. | Melhora digitação em teclados numéricos sem quebrar `1.234,56` nem usar `float`. |
| Ordenação de tabelas | Criar `src/lib/tableSort.ts` (`useTableSort<T, K>` + comparadores para string `pt-BR`, número e data ISO). | Reutilizado em `BillsPage` e `IncomesPage`. |
| Autocomplete Empresa/Loja | Criar componente acessível `StoreAutocomplete` em `src/features/bills/components/StoreAutocomplete.tsx` (combobox com filtro em tempo real, seleção por clique/Enter/setas e vinculação automática de `store_id`). | Substitui o par redundante "Empresa / Loja" + "Loja cadastrada" no `BillForm`. |
| Botões de ação com tooltip | Criar componente reutilizável `IconActionButton` (ou padrão `Tooltip` + `Button size="icon"` + `aria-label`). | Evita repetição e garante acessibilidade em todas as tabelas. |

## 2. Modelo de dados

Sem alterações de banco (consome `bills.reference_month` quando disponível pela Spec 009).

## 3. Segurança (RLS)

Mantém os mesmos endpoints/hooks autenticados com RLS e mascaramento de dados bancários (`maskBankCode`).

## 4. Contratos (API, funções, ferramentas)

- `normalizeDecimalInput(input: string): string` em `src/lib/money.ts`.
- `useTableSort<T, K>(items, config)` em `src/lib/tableSort.ts`.

## 5. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Confusão entre ponto de milhar (`1.200`) e ponto decimal (`12.50`) | Converter `.` → `,` apenas quando o texto não contém `,` e termina com `.` seguido de 1 ou 2 dígitos (`^\d+\.\d{1,2}$`) ou ao digitar o ponto decimal. |
| Quebra de seletores em testes existentes (`BillsPage.test.tsx`, `BillForm.test.tsx`, `IncomesPage.test.tsx`) | Manter `aria-label` claros ("Marcar como pago", "Editar", "Excluir", "Filtros", "Limpar filtros") e atualizar testes de integração/componente junto com cada tarefa. |

## 6. Mapeamento spec → plano

| Spec | Onde é atendida |
|---|---|
| US-1 | `src/lib/money.ts`, `src/features/bills/components/StoreAutocomplete.tsx`, `src/features/bills/components/BillForm.tsx` |
| US-2 | `src/components/ui/{dialog,tooltip,table}.tsx`, `src/lib/tableSort.ts`, `src/features/bills/components/BillsPage.tsx` |
| US-3 | `src/features/incomes/components/IncomesPage.tsx` |
