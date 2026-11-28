# Plano técnico 011 — Layout da Navegação Principal e Homepage

Deriva de `spec.md` e `specs/constitution.md`.

## 1. Arquitetura e decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Link no título | Substituir `<span>Xilas Finance</span>` por `<Link to="/">Xilas Finance</Link>` em `src/app/AppLayout.tsx`. | Navegação padrão de marca para a home. |
| Ícones no menu | Usar ícones `lucide-react` (`Home`, `Receipt`, `Wallet`, `MessageSquare`, `Settings`) nos itens de `navLinks`. | Melhora escaneabilidade visual mantendo consistência com o restante do app. |
| Avatar com iniciais | Criar helper puro `getUserInitials(name, email)` + hook `useUserProfile` consultando `profiles.display_name` (fallback `user_metadata.display_name`/`full_name` → prefixo do e-mail). | Garante iniciais corretas mesmo se `display_name` não estiver preenchido. |
| Menu mobile | Em viewports `< md`, ocultar a barra horizontal de links e exibir botão hambúrguer (`Menu`/`X`) abrindo drawer/painel mobile com links, iniciais e botão "Sair". | Experiência mobile-first limpa sem quebra desordenada do header. |
| Homepage | Em `DashboardPage.tsx`, mover o botão `Mês atual` para antes do botão `ChevronLeft` dentro do `<nav aria-label="Navegação de mês">` e alterar o label do CTA para `"Registrar primeira despesa"`. | Mudança localizada e direta. |

## 2. Modelo de dados

Sem alterações de banco. Apenas leitura da tabela existente `public.profiles` (`display_name`).

## 3. Segurança (RLS)

Leitura de `profiles` usa a política existente `profiles_select_own`.

## 4. Contratos (API, funções, ferramentas)

- `getUserInitials(displayName?: string | null, email?: string | null): string`

## 5. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Testes existentes que buscam o e-mail ou `ThemeToggle` no header | Atualizar testes de layout/navegação (`AppLayout`, `ThemeToggle`, `e2eFlows`) conforme a nova spec. |

## 6. Mapeamento spec → plano

| Spec | Onde é atendida |
|---|---|
| US-1 | `src/app/AppLayout.tsx`, `src/features/auth/hooks/useUserProfile.ts` |
| US-2 | `src/features/dashboard/components/DashboardPage.tsx` |
