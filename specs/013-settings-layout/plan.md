# Plano técnico 013 — Layout de Configurações (Submenu à Esquerda, Aparência, Tabelas e Modais)

Deriva de `spec.md` e `specs/constitution.md`.

## 1. Arquitetura e decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Layout lateral | Em `SettingsPage.tsx`, usar grid/flex em 2 colunas (`md:grid-cols-[220px_1fr]`) com `<nav aria-label="Submenu de configurações">` vertical à esquerda e conteúdo à direita. | Atende o posicionamento à esquerda no desktop e empilha de forma limpa no mobile. |
| Aba Aparência | Adicionar aba `aparencia` em `SettingsPage.tsx` com componente de seleção de tema claro/escuro/sistema usando `useTheme()` (e `ThemeToggle`). | Centraliza preferências visuais em Configurações após remoção do cabeçalho. |
| Tabelas e modais | Reutilizar `Table`, `Dialog` e `Tooltip` (`src/components/ui/`, criados na Spec 012 T-01) em `CategoriesPage.tsx`, `StoresSection.tsx` e `BanksSection.tsx`. | Consistência visual com Despesas e Rendas sem duplicar primitivos. |
| Confirmação de exclusão | Manter confirmação explícita (em modal ou área de confirmação clara) incluindo reatribuição de categoria com contas vinculadas. | Preserva segurança contra exclusões acidentais. |

## 2. Modelo de dados

Sem alterações de banco.

## 3. Segurança (RLS)

Sem alterações de RLS; mantém `maskBankCode` para agência e conta na tabela de Bancos.

## 4. Contratos (API, funções, ferramentas)

- Query param `?aba=categorias|lojas|bancos|aparencia` em `/configuracoes`.

## 5. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Quebra de testes existentes de `CategoriesPage.test.tsx` e `SettingsPage.test.tsx` que assumem formulário inline | Atualizar testes para abrir o modal ao clicar em "Nova categoria"/"Nova loja"/"Novo banco" e validar tabela + ícones com `aria-label`. |

## 6. Mapeamento spec → plano

| Spec | Onde é atendida |
|---|---|
| US-1 | `src/features/settings/components/SettingsPage.tsx`, `src/app/ThemeToggle.tsx` |
| US-2 | `src/features/categories/components/CategoriesPage.tsx`, `src/features/stores/components/StoresSection.tsx`, `src/features/banks/components/BanksSection.tsx` |
