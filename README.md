# Xilas Finance

Controle financeiro pessoal: contas, categorias, resumo mensal com gráficos e um chatbot para adicionar e consultar gastos.

**Stack:** React, TypeScript, Tailwind, shadcn/ui, Supabase · **Deploy:** Vercel · **Código:** GitHub

## Este projeto usa Spec-Driven Development

Nada é implementado sem spec aprovada e tarefa. Leia nesta ordem:

1. [`specs/constitution.md`](specs/constitution.md): princípios
2. [`specs/001-core/spec.md`](specs/001-core/spec.md): o quê e por quê
3. [`specs/001-core/plan.md`](specs/001-core/plan.md): como
4. [`specs/001-core/tasks.md`](specs/001-core/tasks.md): o que fazer agora
5. [`AGENTS.md`](AGENTS.md): regras para agents e humanos
6. [`specs/README.md`](specs/README.md): ciclo de vida das specs

## Começando

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run dev
npm run check                # specs + typecheck + lint + testes
```

Para adicionar componentes shadcn: `npx shadcn@latest add button` (o `components.json` já está configurado).

## Para agents

`AGENTS.md` é a fonte das regras. `CLAUDE.md`, `.cursor/rules/` e `.github/copilot-instructions.md` apontam para ele.
No Claude Code: `/specify`, `/plan`, `/tasks`, `/implement`, `/sdd-check`.

## Proteções automáticas

- `npm run check:specs`: estrutura das specs, IDs de tarefa e portões de aprovação (CI).
- Workflow `SDD PR`: exige `Spec:` e `Task:` no PR e `tasks.md` atualizado quando o PR mexe em `src/`, `api/` ou `supabase/`. Para hotfix, use o label `sdd-exempt` e explique o motivo.
- Recomendado no GitHub: proteger a `main`, exigir os checks `CI` e `SDD PR` e revisão obrigatória em `specs/`.
