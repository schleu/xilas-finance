# Spec 003 — Renomeação para Despesas e Configurações Gerais (Categorias, Lojas e Bancos)

**Status:** rascunho · **Versão:** 0.1 · **Foco:** o quê e por quê (sem decisões de implementação)

## Objetivo

Eliminar a ambiguidade entre "contas a pagar" e "contas bancárias" renomeando gastos para **Despesas** na interface, e centralizar em uma única tela de **Configurações** (com submenu interno) o gerenciamento de **Categorias**, **Lojas** (online e físicas/supermercados com padrões pré-cadastrados) e **Bancos** (com suporte a débito em conta e cartão de crédito com dia de vencimento).

## Escopo

**Dentro:** renomeação de "Contas" para "Despesas" na UI quando referente a gastos, nova página `/configuracoes` com submenu interno (`Categorias`, `Lojas`, `Bancos`), CRUD de Lojas (Online e Física/Supermercados) com lojas padrão criadas automaticamente por usuário, CRUD de Bancos com débito em conta (agência e conta mascaradas) e cartão de crédito (dia de vencimento), integração de Lojas e Bancos no formulário de Despesas.
**Fora:** integração Open Finance, fatura detalhada/parcelamento de cartão de crédito, saldo bancário automático.

## Glossário

- **Despesa:** gasto/compromisso financeiro (anteriormente exibido como "Conta" na interface; a tabela `bills` no banco pode manter o nome interno para evitar quebras).
- **Configurações gerais:** página única `/configuracoes` com submenu interno para alternar entre `Categorias`, `Lojas` e `Bancos`.
- **Loja:** estabelecimento onde o usuário compra, classificado em `Online` ou `Física` (incluindo o grupo `Supermercado`).
- **Banco:** instituição financeira cadastrada pelo usuário que pode possuir **débito em conta** (agência e conta) e/ou **cartão de crédito** (com dia de vencimento).

## US-1 — Renomear "Contas" para "Despesas"

Como usuário, quero que os gastos sejam chamados de "Despesas" em toda a interface para não confundir com minhas contas bancárias.

**Critérios de aceite**
- [ ] A navegação principal exibe **"Despesas"** (rota `/despesas`, mantendo redirecionamento automático de `/contas` → `/despesas`).
- [ ] Títulos, botões, filtros, cards da homepage, mensagens de estado vazio e textos do chatbot referentes a gastos utilizam **"Despesa" / "Despesas"** em vez de "Conta" / "Contas" (preservando expressões próprias como "débito em conta" e "conta bancária").

## US-2 — Página unificada de Configurações gerais

Como usuário, quero acessar Categorias, Lojas e Bancos em uma única página de Configurações com submenu interno para manter o menu principal limpo e organizado.

**Critérios de aceite**
- [ ] O menu principal substitui o item "Categorias" por **"Configurações"** (`/configuracoes`), mantendo redirecionamento de `/categorias` → `/configuracoes?aba=categorias`.
- [ ] Dentro de `/configuracoes`, existe um submenu claro e responsivo (desktop e mobile) permitindo alternar entre **Categorias**, **Lojas** e **Bancos** sem sair da página.
- [ ] A aba **Categorias** preserva integralmente todas as regras e critérios da US-3 da `001-core`.

## US-3 — Gerenciar Lojas (Online e Físicas / Supermercados)

Como usuário, quero ter minhas lojas online e supermercados já pré-cadastrados e poder adicionar/editar/excluir outros para vincular rapidamente às minhas despesas.

**Critérios de aceite**
- [ ] Ao criar conta (e por migração para usuários existentes), cada usuário recebe automaticamente as lojas padrão:
  - **Online:** `Amazon`, `Shopee`, `AliExpress`, `Mercado Livre`
  - **Física (Supermercados):** `Assaí`, `Pão de Açúcar`, `Atacadão`, `Cometa`, `São Luiz`, `Nidobox`
- [ ] Usuário pode criar, editar e excluir lojas informando: nome* (único por usuário sem diferenciar maiúsculas), tipo* (`online` ou `fisica`) e subtipo opcional (`supermercado` ou `outro` quando física).
- [ ] Na tela de Lojas em Configurações, as lojas são exibidas organizadas entre **Online** e **Físicas** (destacando **Supermercados**).
- [ ] No formulário de despesa, o usuário pode selecionar uma loja cadastrada (ou digitar um nome avulso no campo Empresa/Loja).
- [ ] Isolamento total por usuário via RLS.

## US-4 — Gerenciar Bancos (Débito em conta e Cartão de crédito)

Como usuário, quero cadastrar meus bancos com dados de débito em conta e/ou cartão de crédito (com dia de vencimento) para reutilizá-los ao registrar despesas e rendas.

**Critérios de aceite**
- [ ] Usuário pode criar, editar e excluir bancos informando:
  - **Nome do banco*** (obrigatório, ex.: "Nubank", "Banco do Brasil")
  - **Débito em conta (opcional):** quando ativado, exige **agência*** e **conta***
  - **Cartão de crédito (opcional):** quando ativado, exige **dia de vencimento*** (1 a 31) e permite apelido opcional do cartão
- [ ] Na listagem de bancos, agência e número da conta aparecem mascarados (`••••1234`); os valores completos aparecem apenas na edição.
- [ ] No formulário de despesa:
  - Quando `tipo = débito em conta`, o usuário pode selecionar um banco cadastrado com débito em conta (preenchendo agência/conta automaticamente) ou informar manualmente.
  - Quando `tipo = cartão de crédito`, o usuário pode selecionar um banco cadastrado com cartão de crédito (podendo usar o dia de vencimento cadastrado como sugestão de vencimento).
- [ ] Excluir um banco não apaga despesas históricas vinculadas a ele (`on delete set null`, preservando snapshot em `bills`).
- [ ] Dados bancários (banco, agência, conta) nunca aparecem em logs nem são enviados ao LLM do chatbot.
- [ ] Isolamento total por usuário via RLS.

## Requisitos não funcionais

- **Privacidade/segurança:** RLS obrigatória em `stores` e `banks`; testes pgTAP de isolamento por usuário; auditoria garantindo que `banks` (agência/conta) nunca vai ao LLM ou logs.
- **Acessibilidade e responsivo:** submenu de Configurações navegável por teclado e adaptado para telas mobile.

## Premissas adotadas

1. A tabela `bills` mantém o nome interno no banco de dados para preservar estabilidade das migrações e funções da `001-core`; a mudança "Contas" → "Despesas" ocorre na camada de interface e rotas (com redirect de `/contas`).
2. `bills` recebe FKs opcionais `store_id` e `bank_id` (`on delete set null`), mantendo snapshot nos campos existentes (`company`, `bank`, `agency`, `account_number`) para compatibilidade retroativa.

## Histórico

- 0.1 — Rascunho inicial (substitui e expande a antiga `003-bank-accounts`).
