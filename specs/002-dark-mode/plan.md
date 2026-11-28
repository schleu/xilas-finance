# Plano técnico 002 — Dark Mode

Deriva de `spec.md` v0.1 e `specs/constitution.md`.

## 1. Arquitetura e decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Estado do tema | `ThemeProvider` em `src/app/ThemeProvider.tsx` com React Context + `localStorage` (`xilas-theme`) | Simples, zero dependências extras, funciona com Tailwind `.dark` |
| Anti-FOUC | Script inline mínimo em `index.html` antes do bundle React | Aplica classe `.dark` no `<html>` antes do primeiro paint |
| Tokens de cor | Variáveis CSS `:root` e `.dark` em `src/index.css` | Padrão shadcn/ui já adotado no projeto |
| Gráficos | Usar variáveis CSS (`hsl(var(--...))` / `var(--chart-*)`) nos gráficos Recharts | Cores e eixos se adaptam automaticamente ao modo escuro |
| Controle UI | Botão/menu acessível no header (`ThemeToggle`) usando ícones `lucide-react` | Consistente com o layout existente |

## 2. Modelo de dados

Sem alterações no banco de dados. Preferência armazenada apenas em `localStorage` sob a chave `xilas-theme` com valores `"light" | "dark" | "system"`.

## 3. Segurança (RLS)

Não aplicável (sem novas tabelas ou endpoints).

## 4. Contratos (API, funções, ferramentas)

- Hook `useTheme()`: retorna `{ theme, resolvedTheme, setTheme }`.
  - `theme`: `"light" | "dark" | "system"`
  - `resolvedTheme`: `"light" | "dark"`

## 5. Riscos e mitigações

- **Cores hardcoded (ex.: `bg-white`, `text-slate-900`, `bg-red-50`):** podem quebrar contraste no modo escuro. Mitigação: auditoria de classes hardcoded em `src/features/` e substituição por tokens semânticos (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `dark:*`).
- **Gráficos Recharts:** tooltips e grid lines com cores fixas podem ficar ilegíveis no escuro. Mitigação: estilizar `CartesianGrid`, `XAxis`, `YAxis` e `Tooltip` com tokens do tema.

## 6. Mapeamento spec → plano

| Spec | Onde é atendida |
|---|---|
| US-1 | `index.html` (anti-FOUC), `src/app/ThemeProvider.tsx`, `ThemeToggle` no layout e auditoria de contraste em `src/features/` |
