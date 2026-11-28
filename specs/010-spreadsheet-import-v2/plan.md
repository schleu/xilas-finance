# Plano técnico 010 — Importação Aprimorada de Planilhas (CSV, XLS e XLSX)

Deriva de `spec.md` e `specs/constitution.md`.

## 1. Arquitetura e decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Leitura de XLS/XLSX | Adicionar dependência `xlsx` (SheetJS) para ler `.xls` e `.xlsx` em `ArrayBuffer` (mantendo parser CSV leve e consistente). | Suporte completo a planilhas Excel antigas (`.xls`) e modernas (`.xlsx`) sem backend adicional. |
| Higienização e modelo de linhas | Criar/estender `src/features/csvImport/lib/csvParser.ts` (e `spreadsheetParser.ts`) higienizando `\u00A0`/caracteres invisíveis, valores monetários mistos (`100`, `R$\u00A021,22`, `\u00A050,24`, `R$169.27`, `188.56`, `240,76`, `1.234,56`), status (`pago`/`paga`/`paid`, `pendente`/`pending`) e retornando `SpreadsheetPreviewRow<T>[]` com `lineNumber`, `cells`, `fieldErrors`, `rowErrors`, `isValid` e `parsedData`. | Permite destacar exatamente a célula com erro dentro da tabela de pré-visualização e trata todos os casos reais de `file_example/modelo-despesas.csv`. |
| Datas `dd/mm/yyyy` | Tratar datas seriais numéricas do Excel, objetos `Date`, `dd/mm/yyyy`, `d/m/yyyy` e ISO `yyyy-mm-dd`, exibindo sempre `dd/mm/yyyy` na tabela e convertendo para ISO `YYYY-MM-DD` no payload Zod. | Evita falhas comuns de planilhas Excel em pt-BR. |
| Modelo CSV | `generateBillsCsvTemplate(categories)` gera cabeçalho com `mes_referencia` + linhas comentadas (`#`) listando as opções válidas de `tipo_pagamento`, `status` e as `categoria`s do usuário + linha de exemplo. | Autoexplicativo para o usuário e ignorado automaticamente pelo parser na reimportação. |
| Modal de importação | Renderizar `CsvImportDialog` usando o componente `Dialog` (`src/components/ui/dialog.tsx`) com largura ampliada e `Table` responsiva com scroll. | Mantém a página principal limpa e dá espaço confortável para inspecionar colunas e erros. |

## 2. Modelo de dados

Sem alterações de banco além de `bills.reference_month` (coberta pela Spec 009).

## 3. Segurança (RLS)

Inserções em lote continuam usando o cliente Supabase autenticado do usuário, validadas pelos schemas Zod (`billSchema` / `incomeSchema`) e protegidas pelas políticas RLS existentes.

## 4. Contratos (API, funções, ferramentas)

- `readSpreadsheetFile(file: File): Promise<string[][]>` — detecta `.csv`, `.xls`, `.xlsx` e extrai matriz de células higienizadas.
- `parseAndValidateBillsRows(rows, deps)` / `parseAndValidateIncomesRows(rows, deps)` → `{ rows: SpreadsheetPreviewRow<T>[], validRows: T[], invalidCount: number }`.
- `generateBillsCsvTemplate(categories?: Category[]): string`.

## 5. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Datas do Excel virem como número serial (ex.: `46366`) | Converter seriais Excel via utilitário explícito testado unitariamente para `dd/mm/yyyy`. |
| Arquivos com muitas colunas ou valores longos no modal | Tabela com `overflow-x-auto` e `max-h` com rolagem interna dentro do `Dialog`. |

## 6. Mapeamento spec → plano

| Spec | Onde é atendida |
|---|---|
| US-1 | `src/features/csvImport/lib/spreadsheetParser.ts`, `src/features/csvImport/lib/csvParser.ts`, `src/features/csvImport/components/CsvImportDialog.tsx` |
| US-2 | `src/features/csvImport/lib/csvParser.ts`, `src/features/csvImport/components/CsvImportDialog.tsx` |
