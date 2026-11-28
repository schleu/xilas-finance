# Spec 005 — Área de Renda (Receitas, Saldo na Homepage e Cadastro pelo Chat)

**Status:** rascunho · **Versão:** 0.1 · **Foco:** o quê e por quê (sem decisões de implementação)

## Objetivo

Permitir que o usuário registre e acompanhe suas entradas de dinheiro (rendas fixas ou variáveis, por tipo e banco depositado), visualize o total de rendas e o saldo do mês na Homepage e também consiga lançar novas rendas conversando com o chatbot.

## Escopo

**Dentro:** nova tela `/rendas` com CRUD completo de rendas, gerenciamento de tipos de renda (padrões `Salário`, `Freela`, `Outros` + criação de novos tipos pelo usuário), vínculo opcional com banco depositado (cadastrado em Configurações), exibição de **Total de Rendas** e **Saldo do mês** (`Rendas − Despesas pagas`) na Homepage, e cadastro de renda pelo chatbot com confirmação explícita.
**Fora:** conciliação bancária automática, cálculo de imposto de renda/INSS, projeção anual de investimentos.

## Glossário

- **Renda:** entrada financeira registrada com descrição, valor em centavos, data de recebimento, natureza (`fixa` ou `variável`), tipo de renda e banco depositado.
- **Saldo do mês:** diferença entre o total de rendas do mês selecionado e o total de despesas **pagas** no mesmo mês.

## US-1 — Gerenciar rendas e tipos de renda

Como usuário, quero cadastrar, filtrar, editar e excluir minhas rendas para acompanhar quanto recebo por mês e de onde vem cada entrada.

**Critérios de aceite**
- [ ] Cada usuário inicia (e recebe via migração) os tipos de renda padrão: **Salário**, **Freela** e **Outros**, podendo criar, renomear e excluir tipos customizados (nomes únicos por usuário sem diferenciar maiúsculas; bloqueio se em uso).
- [ ] Ao cadastrar/editar uma renda, o formulário valida:
  - **Descrição*** (1–120 caracteres)
  - **Valor*** (maior que zero, em BRL / centavos inteiros)
  - **Data*** (data do recebimento)
  - **Natureza*** (`fixa` ou `variável`)
  - **Tipo de renda*** (um dos tipos cadastrados do usuário)
  - **Banco depositado** (opcional: seleção entre os bancos cadastrados em Configurações)
- [ ] Lista de rendas em `/rendas` com filtros por mês, natureza (`fixa`/`variável`) e tipo de renda, mais edição e exclusão com confirmação.
- [ ] Isolamento total por usuário via RLS em `income_types` e `incomes`.

## US-2 — Total de Rendas e Saldo na Homepage

Como usuário, quero ver na Homepage quanto recebi no mês e qual é o meu saldo após as despesas pagas.

**Critérios de aceite**
- [ ] A Homepage exibe o card **Total de rendas** do mês selecionado.
- [ ] A Homepage exibe o card **Saldo do mês** (`Total de rendas − Total de despesas pagas`), destacando visualmente saldo positivo ou negativo com contraste adequado (claro e escuro).
- [ ] Os valores atualizam automaticamente ao navegar entre meses ou após cadastrar/editar/excluir rendas ou despesas.

## US-3 — Adicionar renda pelo chatbot

Como usuário, quero informar uma entrada de dinheiro em linguagem natural no chat para cadastrá-la rapidamente com confirmação.

**Critérios de aceite**
- [ ] Ao enviar algo como `"Recebi 1500 de freela hoje"`, o bot extrai descrição, valor, data e tipo, pergunta **apenas** os campos obrigatórios que faltarem e exibe um **cartão de confirmação** (`propose_income`).
- [ ] O bot **nunca** grava a renda sem confirmação explícita do usuário (Constituição §5).
- [ ] Após confirmar, a renda é salva pelo mesmo schema Zod e serviço da UI manual, invalidando imediatamente o cache de `/rendas` e da Homepage.
- [ ] Nenhum dado bancário sensível (agência/conta) é enviado ao LLM.

## Requisitos não funcionais

- **Privacidade/segurança:** RLS obrigatória em `income_types` e `incomes`; teste pgTAP de isolamento por usuário.
- **Precisão monetária:** valores de renda sempre em centavos inteiros (`integer`), nunca `float`.

## Premissas adotadas

1. O mês de referência das rendas é o mês da coluna `received_date`.
2. O campo `bank_id` em `incomes` referencia `public.banks` (da `003-settings-and-expenses-rename`) com `on delete set null`.

## Histórico

- 0.1 — Rascunho inicial.
