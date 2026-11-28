# Tarefas 010 — Importação Aprimorada de Planilhas (CSV, XLS e XLSX)

Cada tarefa cabe em um PR pequeno. `[P]` = pode rodar em paralelo. `Dep:` = depende de.
Formato obrigatório: `- [ ] **T-NN Título.** Descrição. *Dep:* T-XX. *Pronto:* critério verificável.`

## Fase 1 — Parser, higienização e modelo CSV

- [x] **T-01 Adicionar leitura de XLS/XLSX, higienização e retorno de erros por célula.** Instalar `xlsx`, implementar leitura unificada de `.csv`/`.xls`/`.xlsx`, higienização prévia (incluindo `\u00A0`, `R$` sem espaço, ponto decimal de centavos, inteiros e sinônimos de status como `paga`/`Pago`), padronização de datas para `dd/mm/yyyy`, suporte a `mes_referencia`, retorno detalhado de erros por coluna/linha e modelo CSV com opções de `tipo_pagamento`, `status` e `categoria`. *Pronto:* testes unitários cobrem `file_example/modelo-despesas.csv`, `.xls`, `.xlsx`, datas seriais Excel, `dd/mm/yyyy`, linhas `#` de instrução e erros por célula.

## Fase 2 — Modal com tabela de pré-visualização

- [x] **T-02 Refatorar `CsvImportDialog` em modal com tabela higienizada e destaque de erros.** Exibir importação em `Dialog` modal aceitando `.csv/.xls/.xlsx`, renderizando todas as linhas higienizadas em tabela com colunas e sinalização visual dos erros diretamente nas linhas/células. *Dep:* T-01. *Pronto:* critérios das US-1 e US-2 verificados em testes de componente e `npm run check` verde.
