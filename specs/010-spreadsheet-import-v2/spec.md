# Spec 010 — Importação Aprimorada de Planilhas (CSV, XLS e XLSX)

**Status:** implementada · **Versão:** 0.2 · **Foco:** o quê e por quê (sem decisões de implementação)

## Objetivo

Modernizar o fluxo de importação de despesas e rendas para aceitar arquivos `.csv`, `.xls` e `.xlsx`, higienizar os dados automaticamente antes da exibição, exibir todos os registros em uma tabela estruturada com os erros sinalizados diretamente na tabela, adotar `dd/mm/yyyy` como padrão de datas e enriquecer o modelo CSV com as opções válidas de `tipo_pagamento`, `status` e `categoria`.

## Escopo

**Dentro:**
- Suporte a arquivos `.csv`, `.xls` e `.xlsx` no importador de despesas e rendas.
- Higienização automática dos dados antes da exibição e validação (espaços extras, BOM, caracteres invisíveis, valores monetários, datas — incluindo seriais do Excel — convertidas para `dd/mm/yyyy`, normalização de texto para tipo de pagamento, status e natureza).
- Exibição dos dados importados em uma tabela com colunas nomeadas e destaque visual dos erros diretamente nas linhas/células com problema.
- Coluna opcional `mes_referencia` na importação de despesas (derivada do vencimento quando vazia/ausente).
- Atualização do modelo CSV de despesas com as opções válidas de `tipo_pagamento`, `status` e `categoria`.
- Exibição do fluxo de importação dentro de um modal.

**Fora:**
- Edição inline de células na tabela de pré-visualização.
- Criação automática de categorias ou bancos inexistentes durante a importação.

## US-1 — Leitura, higienização e pré-visualização em tabela com sinalização de erros

Como usuário, quero enviar arquivos `.csv`, `.xls` ou `.xlsx` e revisar todos os dados higienizados em uma tabela com os erros destacados diretamente nas colunas antes de importar.

**Critérios de aceite**
- [ ] O seletor de arquivo aceita `.csv`, `.xls` e `.xlsx`.
- [ ] Antes de exibir, o parser higieniza os dados:
  - Remove BOM, espaços extras, quebras invisíveis e espaços não separáveis (`\u00A0`, ex.: `R$ 21,22`, ` 50,24`).
  - Normaliza valores monetários em formatos mistos (`100`, `R$ 21,22`, ` 50,24`, `R$169.27`, `188.56`, `240,76`, `1.234,56`) para exibição padronizada em reais (`dd,dd`) e centavos inteiros, sem confundir ponto decimal de centavos com separador de milhar.
  - Normaliza status aceitando sinônimos e variações de caixa/gênero (`pago`, `paga`, `Pago`, `paid` → `Pago`; `pendente`, `pending` → `Pendente`), sinalizando erro para valores desconhecidos.
  - Normaliza datas — inclusive seriais do Excel — para `dd/mm/yyyy`.
  - Quando a coluna `mes_referencia` estiver ausente ou vazia, deriva automaticamente o mês/ano (`MM/YYYY`) a partir da data de vencimento.
- [ ] O padrão de exibição e validação de datas na importação é `dd/mm/yyyy`.
- [ ] Os dados lidos são exibidos em uma tabela com colunas definidas (tanto linhas válidas quanto inválidas).
- [ ] Erros de validação são sinalizados diretamente dentro da tabela (destaque visual na linha/célula e mensagem clara do motivo do erro — por exemplo, `debito` sem banco cadastrado com agência/conta).
- [ ] O fluxo de importação abre em um modal, permitindo importar as linhas válidas ou fechar/cancelar.
- [ ] O arquivo de referência `file_example/modelo-despesas.csv` é usado como caso de teste automatizado cobrindo higienização de valores (`100`, `R$ 21,22`, ` 50,24`, `R$169.27`, `188.56`, `240,76`), status (`paga`, `Pago`, `pendente`) e sinalização de erro nas linhas de débito sem banco.

## US-2 — Modelo CSV enriquecido com opções válidas

Como usuário, quero baixar um modelo CSV de despesas que já indique as opções aceitas de `tipo_pagamento`, `status` e `categoria` para preencher sem erro.

**Critérios de aceite**
- [ ] O modelo CSV de despesas inclui a coluna `mes_referencia` e traz as opções aceitas de `tipo_pagamento` (`pix`, `credito`, `debito`), `status` (`pendente`, `pago`) e `categoria` (usando as categorias cadastradas do usuário).
- [ ] O parser ignora eventuais linhas de instrução/comentário (iniciadas por `#`) geradas no modelo CSV.

## Requisitos não funcionais

- **Privacidade/segurança:** leitura e higienização ocorrem 100% no cliente; limite máximo de 500 linhas por importação mantido; inserção respeita RLS e Zod.
- **Integridade financeira:** valores convertidos para centavos inteiros antes de gravar.

## Histórico

- 0.1 — Rascunho inicial separado da proposta unificada.
- 0.2 — Incorporadas regras concretas de higienização baseadas em `file_example/modelo-despesas.csv` (espaço não separável `\u00A0`, `R$` sem espaço, ponto decimal em centavos como `R$169.27`/`188.56`, inteiros como `100`, status `paga`/`Pago`, e erro explícito em débito sem banco).
