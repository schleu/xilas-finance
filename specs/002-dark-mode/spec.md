# Spec 002 — Dark Mode

**Status:** aprovada · **Versão:** 0.2 · **Foco:** o quê e por quê (sem decisões de implementação)

> Aprovada em 27/11/2026. Implementação liberada.

## Objetivo

Permitir que o usuário alterne o tema visual do Xilas Finance entre claro, escuro e automático (seguindo o sistema operacional), garantindo conforto visual e legibilidade em todos os ambientes.

## Escopo

**Dentro:** alternador de tema no cabeçalho (`Claro`, `Escuro`, `Sistema`), persistência da preferência do usuário no navegador, prevenção de flash de tema errado ao carregar, revisão de contraste em telas, formulários, tabelas, chat e gráficos.
**Fora:** sincronização da preferência de tema no banco de dados entre dispositivos, temas personalizados/cores customizadas.

## Glossário

- **Tema `Sistema`:** acompanha automaticamente a preferência `prefers-color-scheme` do sistema operacional/navegador.

## US-1 — Alternar tema visual

Como usuário, quero escolher entre tema claro, escuro ou automático para usar o app com conforto visual em qualquer horário.

**Critérios de aceite**
- [ ] Existe um controle acessível no cabeçalho (desktop e mobile) para alternar entre `Claro`, `Escuro` e `Sistema`.
- [ ] O padrão para novos acessos é `Sistema`.
- [ ] A escolha é persistida localmente e mantida ao recarregar a página ou reabrir o navegador.
- [ ] Ao escolher `Sistema`, mudanças no tema do sistema operacional refletem imediatamente no app.
- [ ] Não há flash visível do tema claro antes de aplicar o tema escuro no carregamento inicial.
- [ ] Todos os componentes principais (cards, formulários, filtros, modais/diálogos, badges de status/atraso, chat e gráficos da homepage) mantêm contraste adequado (WCAG AA) no modo escuro.

## Requisitos não funcionais

- **Acessibilidade:** contraste mínimo 4.5:1 para texto normal e 3:1 para texto grande/elementos de UI; controle navegável por teclado com `aria-label` claro.
- **Desempenho:** troca de tema instantânea, sem recarregar a página.

## Premissas adotadas

1. A preferência de tema fica salva em `localStorage` do navegador (não requer coluna no banco nem chamada de rede).
2. Os tokens CSS do shadcn/ui (`:root` e `.dark`) já existentes no projeto servem de base para as cores do modo escuro.

## Histórico

- 0.2 — Aprovada para implementação (27/11/2026).
- 0.1 — Rascunho inicial.
