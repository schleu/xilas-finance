# Tarefas 011 — Layout da Navegação Principal e Homepage

Cada tarefa cabe em um PR pequeno. `[P]` = pode rodar em paralelo. `Dep:` = depende de.
Formato obrigatório: `- [ ] **T-NN Título.** Descrição. *Dep:* T-XX. *Pronto:* critério verificável.`

## Fase 1 — Navegação principal e menu mobile (US-1)

- [x] **T-01 Atualizar `AppLayout` com link no título, ícones, avatar de iniciais e menu mobile.** Transformar "Xilas Finance" em link para `/`, adicionar ícones às opções do menu, remover `ThemeToggle` do cabeçalho, trocar o e-mail por avatar circular com iniciais do nome e implementar menu mobile acessível. *Pronto:* critérios da US-1 cobertos por testes e `npm run check` verde.

## Fase 2 — Ajustes na Homepage (US-2)

- [x] **T-02 Ajustar botão "Registrar primeira despesa" e posição de "Mês atual" na Homepage.** `[P]` Atualizar texto do botão de estado vazio para "Registrar primeira despesa" e posicionar "Mês atual" à esquerda do seletor de mês de referência em `DashboardPage.tsx`. *Pronto:* critérios da US-2 verificados em `DashboardPage.test.tsx`.
