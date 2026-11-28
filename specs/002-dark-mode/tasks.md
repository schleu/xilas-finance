# Tarefas 002 — Dark Mode

Cada tarefa cabe em um PR pequeno. `[P]` = pode rodar em paralelo. `Dep:` = depende de.

## Fase 1 — Infraestrutura e seletor de tema (US-1)

- [x] **T-01 ThemeProvider, hook `useTheme` e script anti-FOUC.** Criar `src/app/ThemeProvider.tsx` com suporte a `light | dark | system`, listener de `matchMedia`, persistência em `localStorage` e script inicial em `index.html`. *Pronto:* testes unitários cobrindo padrão `system`, troca, persistência e atualização via `matchMedia`.
- [x] **T-02 Controle de tema no cabeçalho.** Adicionar `ThemeToggle` acessível no layout principal (desktop e mobile) integrado ao `ThemeProvider`. *Dep:* T-01. *Pronto:* teste de componente validando alternância por clique e teclado.
- [x] **T-03 Auditoria de contraste no modo escuro.** Revisar e ajustar classes hardcoded em dashboard (incluindo gráficos Recharts), contas, categorias, auth e chat para garantir legibilidade WCAG AA em `.dark`. *Dep:* T-02. *Pronto:* `npm run check` e `npm run build` verdes, sem cores quebradas no modo escuro.
