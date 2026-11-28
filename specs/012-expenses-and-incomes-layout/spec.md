# Spec 012 — Layout de Despesas e Rendas (Modais, Tabelas Ordenáveis, Autocomplete e Ícones)

**Status:** implementada · **Versão:** 0.1 · **Foco:** o quê e por quê (sem decisões de implementação)

## Objetivo

Modernizar a interface de **Despesas** e aplicar a mesma linguagem visual em **Rendas**, trazendo formulários, filtros e importação em modais, tabelas separadas por colunas com ordenação ao clicar nos títulos, autocomplete no campo Empresa/Loja, preenchimento inteligente de data e valor, e botões de ação compactos em ícones com tooltip.

## Escopo

**Dentro:**
- Primitivos compartilhados de UI (`Dialog`, `Tooltip`, `Table`) e utilitários de ordenação e normalização decimal.
- **Despesas:**
  - Formulário de adicionar e editar despesa exibido em modal.
  - Campo "Empresa / Loja" com autocomplete baseado nas empresas/lojas cadastradas, removendo o campo "Loja cadastrada".
  - Data de vencimento com valor padrão = data atual (`America/Fortaleza`) ao criar nova despesa.
  - Campo Valor convertendo ponto em vírgula quando representar centavos (ex.: `120.50` → `120,50`).
  - Formulário de importação exibido em modal (integrado à Spec 010).
  - Lançamentos em tabela separada por colunas, com ordenação ao clicar no título de cada coluna.
  - Filtros abertos em um modal + botão "Limpar filtros".
  - Botões "Marcar como pago", "Editar" e "Excluir" exibidos apenas como ícones que mostram o texto da ação ao passar o mouse (tooltip).
- **Rendas:**
  - Paridade visual com Despesas: formulário (criar/editar) em modal com conversão `.` → `,` no valor, importação em modal, filtros em modal + botão "Limpar filtros", tabela com colunas ordenáveis e botões "Editar" e "Excluir" apenas como ícones com tooltip.

**Fora:**
- Alteração de layout de Configurações (Spec 013).
- Alteração de regras de negócio de recorrência ou NF-e de supermercado (mantidas dentro do modal de despesa).

## US-1 — Formulário de Despesas em modal com autocomplete, data padrão e valor inteligente

Como usuário, quero cadastrar e editar despesas em um modal ágil, com autocomplete de empresa/loja, vencimento pré-preenchido com hoje e conversão automática de ponto para vírgula nos centavos.

**Critérios de aceite**
- [ ] Clicar em "Nova despesa" ou "Editar" abre o formulário dentro de um modal acessível (fechável por botão ou tecla `Escape`).
- [ ] O campo "Loja cadastrada" não é mais exibido; o campo **"Empresa / Loja"** oferece autocomplete filtrando as lojas cadastradas, vinculando `store_id` automaticamente quando uma loja cadastrada é escolhida/correspondida e permitindo texto livre caso contrário.
- [ ] Ao criar uma nova despesa, o campo **Vencimento** inicia preenchido com a data atual (`America/Fortaleza`).
- [ ] No campo **Valor**, digitar ponto como separador decimal de centavos (ex.: `45.90` ou `45.9`) converte o ponto em vírgula (`45,90` / `45,9`) sem quebrar valores com separador de milhar (ex.: `1.200,50`).

## US-2 — Tabela ordenável, filtros em modal e ações em ícones na tela de Despesas

Como usuário, quero visualizar minhas despesas em uma tabela organizada por colunas ordenáveis, filtrar em um modal com opção de limpar filtros e acionar pagamentos/edição/exclusão por ícones com tooltip.

**Critérios de aceite**
- [ ] Os lançamentos de despesas são exibidos em uma tabela com colunas bem definidas (Descrição, Empresa/Loja, Categoria, Mês Ref., Vencimento, Pagamento, Status, Valor, Ações).
- [ ] Clicar no cabeçalho de uma coluna ordena os lançamentos (alternando entre ascendente e descendente, com indicador visual e `aria-sort`).
- [ ] Os filtros (mês, categoria, status) são abertos em um modal por meio de um botão "Filtros", acompanhado de um botão **"Limpar filtros"** que restaura os filtros padrão.
- [ ] A importação de arquivo abre em um modal.
- [ ] Os botões **Marcar como pago**, **Editar** e **Excluir** exibem apenas ícones, mostram o texto da ação em tooltip ao passar o mouse (ou focar via teclado) e possuem `aria-label` correspondente.

## US-3 — Paridade visual na tela de Rendas

Como usuário, quero gerenciar minhas rendas com o mesmo padrão visual e de interação de Despesas.

**Critérios de aceite**
- [ ] O formulário de adicionar e editar rendas abre em um modal, com conversão `.` → `,` para centavos no campo Valor.
- [ ] A importação de arquivo abre em um modal.
- [ ] Os filtros de Rendas (mês, natureza, tipo) abrem em um modal, com botão **"Limpar filtros"**.
- [ ] Os lançamentos de renda são exibidos em uma tabela separada por colunas (Descrição, Natureza, Tipo, Data, Banco, Valor, Ações) com ordenação ao clicar no título das colunas.
- [ ] Os botões **Editar** e **Excluir** são exibidos apenas como ícones com tooltip ao passar o mouse (e `aria-label`).

## Requisitos não funcionais

- **Acessibilidade e responsividade:** modais com focus trap e fechamento por `Escape`; tooltips ativáveis por hover e foco; tabelas com scroll horizontal em mobile.
- **Integridade financeira:** dinheiro sempre armazenado em centavos inteiros.

## Histórico

- 0.1 — Rascunho inicial separado da proposta unificada.
