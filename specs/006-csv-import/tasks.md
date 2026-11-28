# Tarefas 006 — Importação de Despesas e Rendas via CSV

Cada tarefa cabe em um PR pequeno. `[P]` = pode rodar em paralelo. `Dep:` = depende de.

## Fase 1 — Gerador de modelos e parser/validador CSV (US-1, US-2)

- [ ] **T-01 Gerador de arquivos modelo CSV (Despesas e Rendas).** Implementar geração de `modelo-despesas.csv` e `modelo-rendas.csv` em UTF-8 com BOM e exemplos válidos. *Pronto:* testes unitários garantindo que os modelos gerados passam pelo próprio parser sem erros.
- [ ] **T-02 Parser e validador CSV linha a linha com Zod.** Implementar leitura de `,` e `;`, conversão de BRL para centavos inteiros, datas `DD/MM/AAAA` e `YYYY-MM-DD`, resolução por nome de categorias/lojas/bancos/tipos de renda e validação via `billSchema` e `incomeSchema`. *Dep:* T-01. *Pronto:* testes unitários cobrindo casos válidos, erros por linha e limite de linhas.

## Fase 2 — Interface de importação e integração (US-1, US-2)

- [ ] **T-03 Componente `CsvImportDialog` e integração em Despesas e Rendas.** Criar modal com download do modelo, upload do `.csv`, tabela de pré-visualização (válidas vs erros), confirmação explícita, inserção em lote e invalidação de cache. *Dep:* T-02. *Pronto:* testes de componente cobrindo US-1 e US-2 e `npm run check` verde.
