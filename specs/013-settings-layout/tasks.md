# Tarefas 013 — Layout de Configurações (Submenu à Esquerda, Aparência, Tabelas e Modais)

Cada tarefa cabe em um PR pequeno. `[P]` = pode rodar em paralelo. `Dep:` = depende de.
Formato obrigatório: `- [ ] **T-NN Título.** Descrição. *Dep:* T-XX. *Pronto:* critério verificável.`

## Fase 1 — Submenu à esquerda e Aparência (US-1)

- [x] **T-01 Reestruturar `SettingsPage` com submenu lateral esquerdo e aba Aparência.** Mover o submenu para a coluna esquerda (responsivo no mobile) e adicionar a aba `Aparência` com seleção de tema claro/escuro/sistema. *Pronto:* critérios da US-1 verificados em `SettingsPage.test.tsx`.

## Fase 2 — Tabelas, modais e ícones em Categorias, Lojas e Bancos (US-2)

- [x] **T-02 Refatorar Categorias, Lojas e Bancos com tabelas definidas, modais e ícones com tooltip.** Substituir listas por tabelas com colunas definidas, mover formulários de criação/edição para `Dialog` modal e converter botões Editar/Excluir em ícones com tooltip em `CategoriesPage.tsx`, `StoresSection.tsx` e `BanksSection.tsx`. *Dep:* T-01. *Pronto:* critérios da US-2 verificados em `CategoriesPage.test.tsx`, `SettingsPage.test.tsx` e `npm run check` verde.
