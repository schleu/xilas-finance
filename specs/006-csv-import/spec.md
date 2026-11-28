# Spec 006 — Importação de Despesas e Rendas via CSV

**Status:** aprovada · **Versão:** 0.2 · **Foco:** o quê e por quê (sem decisões de implementação)

> Aprovada em 27/11/2026. Implementação liberada.

## Objetivo

Permitir que o usuário importe despesas e rendas em lote a partir de um arquivo `.csv`, podendo baixar diretamente no sistema o arquivo modelo pronto para preenchimento e revisar/validar cada linha antes de confirmar a gravação.

## Escopo

**Dentro:** download de arquivo modelo `.csv` para Despesas e para Rendas, upload e leitura de `.csv` no navegador, validação linha a linha usando os mesmos schemas Zod da aplicação, pré-visualização mostrando linhas válidas e erros por linha/campo, importação em lote após confirmação explícita do usuário.
**Fora:** importação de extratos bancários em formatos proprietários (OFX/PDF), mapeamento livre de colunas arbitrárias de terceiros (o usuário usa o modelo do sistema).

## Glossário

- **Modelo CSV:** arquivo `.csv` (UTF-8 com BOM para abrir corretamente no Excel) contendo os cabeçalhos esperados e 1–2 linhas de exemplo.

## US-1 — Baixar modelo CSV de Despesas e Rendas

Como usuário, quero baixar um modelo CSV pronto para preencher minhas despesas ou rendas no Excel/Google Sheets sem errar o formato das colunas.

**Critérios de aceite**
- [ ] Na tela de **Despesas**, existe a ação **"Importar CSV"** contendo botão para **baixar o modelo de despesas** (`modelo-despesas.csv`).
- [ ] Na tela de **Rendas**, existe a ação **"Importar CSV"** contendo botão para **baixar o modelo de rendas** (`modelo-rendas.csv`).
- [ ] Os arquivos modelo usam UTF-8 com BOM, separador compatível (`,` ou `;` — aceitos ambos na importação) e incluem cabeçalhos claros em pt-BR + linha de exemplo válida.

## US-2 — Importar Despesas e Rendas via CSV com pré-visualização

Como usuário, quero enviar um arquivo CSV preenchido, ver quais linhas estão válidas ou com erro e confirmar a importação em lote.

**Critérios de aceite**
- [ ] O importador aceita arquivos `.csv` (suportando delimitador `,` ou `;`, valores monetários em formato brasileiro `120,50` ou `120.50` convertidos para centavos inteiros, e datas `DD/MM/AAAA` ou `YYYY-MM-DD`).
- [ ] Categorias, lojas, bancos e tipos de renda informados por nome no CSV são resolvidos (sem diferenciar maiúsculas) para os registros do próprio usuário; se não existirem, a linha indica erro claro.
- [ ] Todas as linhas são validadas com os **mesmos schemas Zod** (`billSchema` e `incomeSchema`), sem jamais usar `float` para armazenar dinheiro.
- [ ] Antes de gravar, a tela mostra um resumo (`X linhas válidas`, `Y com erro`) e a tabela de pré-visualização destacando os erros por linha.
- [ ] O usuário só consegue confirmar a importação quando houver pelo menos 1 linha válida (podendo corrigir o arquivo ou importar apenas as válidas, conforme escolha explícita).
- [ ] Após confirmar, os registros são salvos respeitando RLS do usuário autenticado e o cache das telas/homepage é invalidado imediatamente.

## Requisitos não funcionais

- **Segurança:** processamento do CSV no cliente + inserção via Supabase autenticado com RLS (sem necessidade de nova função de servidor nem envio de dados bancários ao LLM); limite seguro de linhas por upload (ex.: até 500 linhas por arquivo).
- **Validação única:** reutilização obrigatória de `billSchema` e `incomeSchema` (Constituição §6).

## Premissas adotadas

1. O processamento do CSV é 100% client-side (zero custo de servidor e resposta instantânea na pré-visualização).
2. Valores de `débito em conta` no CSV podem referenciar um banco cadastrado em Configurações pelo nome, evitando colocar agência/conta em planilhas soltas.

## Histórico

- 0.1 — Rascunho inicial.
