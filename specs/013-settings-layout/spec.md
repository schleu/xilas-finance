# Spec 013 — Layout de Configurações (Submenu à Esquerda, Aparência, Tabelas e Modais)

**Status:** implementada · **Versão:** 0.1 · **Foco:** o quê e por quê (sem decisões de implementação)

## Objetivo

Reestruturar a página de **Configurações** com submenu lateral à esquerda, trazer a seleção de tema claro/escuro (Aparência) para Configurações e padronizar o gerenciamento de **Categorias**, **Lojas** e **Bancos** com tabelas bem definidas, modais de inserção/edição e botões de ação em ícones com tooltip.

## Escopo

**Dentro:**
- Submenu de Configurações posicionado à esquerda (layout lateral no desktop, responsivo no mobile).
- Nova seção/aba **Aparência** no submenu de Configurações com seleção de tema claro/escuro (e sistema).
- Tabelas definidas com cabeçalhos identificando cada dado em Categorias, Lojas e Bancos.
- Modal dedicado para adicionar (e editar) categoria, loja ou banco, substituindo os formulários fixos no topo das telas.
- Botões **Editar** e **Excluir** exibidos apenas como ícones com tooltip ao passar o mouse (e `aria-label`).

**Fora:**
- Remoção do seletor de tema do menu principal (coberta na Spec 011).
- Alterações no modelo de dados de categorias, lojas ou bancos.

## US-1 — Submenu lateral esquerdo e seleção de tema em Configurações

Como usuário, quero navegar pelas opções de Configurações em um submenu à esquerda e configurar o tema claro/escuro na seção Aparência.

**Critérios de aceite**
- [ ] O submenu de Configurações (Categorias, Lojas, Bancos, Aparência) é exibido à esquerda do conteúdo principal em telas desktop e se adapta de forma responsiva no mobile.
- [ ] A aba **Aparência** permite alternar o tema entre claro, escuro e sistema (reutilizando `ThemeProvider` / `useTheme`).
- [ ] A aba ativa continua refletida na URL (`?aba=categorias|lojas|bancos|aparencia`).

## US-2 — Tabelas definidas, modais de inserção/edição e ícones com tooltip em Categorias, Lojas e Bancos

Como usuário, quero visualizar categorias, lojas e bancos em tabelas claras, abrir um modal ao adicionar ou editar itens e usar ícones com tooltip para editar e excluir.

**Critérios de aceite**
- [ ] **Categorias**, **Lojas** e **Bancos** exibem seus registros em tabelas com colunas bem definidas identificando claramente cada dado (ex.: Nome, Origem/Tipo, Dados bancários/Cartão, Ações).
- [ ] Clicar em "Nova categoria", "Nova loja" ou "Novo banco" (assim como editar um item) abre um modal para inserção/edição dos dados.
- [ ] Os botões **Editar** e **Excluir** são exibidos apenas como ícones; ao passar o mouse (ou focar via teclado), exibem um tooltip com o texto da ação e mantêm `aria-label`.
- [ ] O fluxo de confirmação de exclusão (incluindo reatribuição de categoria em uso) e o mascaramento de agência/conta em Bancos continuam funcionando integralmente.

## Requisitos não funcionais

- **Privacidade/segurança:** agência e conta continuam mascaradas na tabela de Bancos; RLS inalterada.
- **Acessibilidade e responsividade:** modais com foco gerenciado e fechamento por `Escape`; tabelas com rolagem horizontal suave em mobile; botões de ícone com `aria-label` e tooltip.

## Histórico

- 0.1 — Rascunho inicial separado da proposta unificada (com aba Aparência confirmada pelo usuário).
