# Plano técnico 006 — Importação de Despesas e Rendas via CSV

Deriva de `spec.md` v0.1 e `specs/constitution.md`.

## 1. Arquitetura e decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Feature | Nova pasta `src/features/csvImport/{lib,components,hooks}` | Compartilhada entre `BillsPage` (Despesas) e `IncomesPage` (Rendas) |
| Parser CSV | Parser leve RFC 4180 (ou `papaparse`) com detecção automática de delimitador `,` / `;` e suporte a aspas | Lida corretamente com CSV gerado pelo Excel em pt-BR (`;`) e Google Sheets (`,`) |
| Conversão monetária | Reutilizar `parseBRLToCents` de `src/lib/money.ts` | Garante centavos inteiros sem `float` (Constituição §2) |
| Validação | Reutilizar `billSchema` e `incomeSchema` linha a linha | Constituição §6 (validação única) |
| Inserção em lote | `supabase.from("bills" \| "incomes").insert(validRows)` em lotes de até 100 linhas | Respeita RLS do usuário autenticado e invalida queries do TanStack Query |

## 2. Modelo de dados

Sem novas tabelas. Grava diretamente em `public.bills` e `public.incomes` usando as mesmas constraints e RLS existentes.

## 3. Segurança (RLS)

- Toda inserção ocorre com o JWT do usuário autenticado; RLS garante que `user_id = auth.uid()`.
- Limite máximo de 500 linhas por arquivo para evitar travamento do navegador.

## 4. Contratos (API, funções, ferramentas)

- `generateBillsCsvTemplate()` / `generateIncomesCsvTemplate()` → retorna `Blob` UTF-8 com BOM (`\uFEFF`).
- `parseAndValidateBillsCsv(text, { categories, stores, banks })` → `{ validRows, invalidRows }`.
- `parseAndValidateIncomesCsv(text, { incomeTypes, banks })` → `{ validRows, invalidRows }`.
- Componente `CsvImportDialog` reutilizável para `mode="bills" | "incomes"`.

## 5. Riscos e mitigações

- **Encoding ISO-8859-1 do Excel antigo:** se detectar caracteres quebrados (`\uFFFD`), tentar releitura em `windows-1252` via `TextDecoder`.
- **Importação duplicada acidental:** exibir alerta visual se o arquivo tiver linhas idênticas ou confirmar antes de inserir.

## 6. Mapeamento spec → plano

| Spec | Onde é atendida |
|---|---|
| US-1 | `src/features/csvImport/lib/templates.ts` + botão de download em `CsvImportDialog` |
| US-2 | `src/features/csvImport/lib/parser.ts`, `CsvImportDialog` e integração em `BillsPage` e `IncomesPage` |
