# AGENTS.md — Xilas Finance

Instruções para **qualquer agent** (Claude Code, Cursor, Copilot, Codex, Gemini etc.) e para humanos.
Este projeto segue **Spec-Driven Development (SDD)**: a especificação é a fonte da verdade; o código deriva dela.

## Regra zero

**Não escreva código de comportamento sem uma tarefa em `specs/NNN-*/tasks.md` ligada a uma spec aprovada.**
Se a mudança pedida não está especificada, pare, atualize a spec primeiro e peça aprovação.

## Hierarquia de autoridade (em conflito, vence o de cima)

1. `specs/constitution.md` — princípios e convenções do projeto
2. `specs/NNN-*/spec.md` — o quê e por quê (critérios de aceite)
3. `specs/NNN-*/plan.md` — como (arquitetura, dados, contratos)
4. `specs/NNN-*/tasks.md` — tarefas pequenas e verificáveis
5. Código e testes

Código que diverge da spec é um bug do código **ou** da spec. Nunca altere a spec em silêncio só para o código passar.

## Antes de qualquer mudança

1. Leia `specs/constitution.md`.
2. Identifique a feature ativa (`specs/NNN-*/`) e leia `spec.md`, `plan.md` e `tasks.md`.
3. Classifique o pedido:

| Pedido | O que fazer |
|---|---|
| Implementar tarefa existente | Escolha a próxima tarefa não concluída cujas dependências (`Dep:`) estão prontas. Faça **só ela**. |
| Funcionalidade nova ou mudança de comportamento | **Pare.** Atualize `spec.md` (use `specs/_templates/`), depois `plan.md` e `tasks.md`. Espere aprovação humana antes de implementar. |
| Correção de bug | Encontre o critério de aceite violado, escreva um teste que falha, corrija. Se a spec for ambígua ou errada, corrija a spec e registre no Histórico. |
| Refactor / infra / dependências | Crie ou use uma tarefa (`T-NN`). Sem mudança de comportamento. |
| Dúvida sobre requisito | Marque `[NEEDS CLARIFICATION: pergunta]` na spec e **pergunte ao humano**. Não adivinhe. |

## Portões de aprovação

- `**Status:**` da spec: `rascunho` → `aprovada` → `implementada`. **Só um humano** muda para `aprovada`.
- Com a spec em `rascunho`, só tarefas da **Fase 0 (fundação/infra)** podem ser implementadas.
- Mudanças em `specs/constitution.md` exigem aprovação humana explícita. Agents propõem; não aplicam.
- Spec com `[NEEDS CLARIFICATION]` aberto não avança para implementação.

## Fluxo de implementação de uma tarefa

1. Releia os critérios de aceite da US ligada à tarefa.
2. Escreva os testes dos critérios (eles devem falhar).
3. Implemente o mínimo para passar. Sem escopo extra, sem "já que estou aqui".
4. Rode `npm run check` (specs, typecheck, lint, testes). Tudo verde.
5. Marque a tarefa como `[x]` em `tasks.md`.
6. Se algo no plano ou na spec mudou, atualize os documentos e acrescente uma linha no `## Histórico` da spec.
7. Abra PR com as linhas `Spec:` e `Task:` preenchidas (ver `.github/pull_request_template.md`).

## Nunca faça

- Implementar sem tarefa, ou várias tarefas num único PR.
- Usar `float` para dinheiro (use centavos inteiros: `src/lib/money.ts`).
- Expor `service_role` ou chaves de LLM no cliente; usar prefixo `VITE_` em segredo.
- Criar/alterar tabela sem RLS e sem teste de isolamento entre usuários.
- Registrar em log, ou enviar ao LLM, banco/agência/conta do usuário.
- Gravar dados a partir do chatbot sem confirmação explícita do usuário.
- Commitar `.env`, chaves ou dados reais.
- Desativar testes, lint ou `check:specs` para passar o CI.

## Comandos

```bash
npm run dev          # servidor de desenvolvimento
npm run check        # specs + typecheck + lint + testes (rode antes de todo PR)
npm run check:specs  # valida a estrutura e os portões do SDD
npm run test         # vitest
npm run build        # typecheck + build de produção
```

## Mapa do repositório

```
specs/                 constitution.md, README.md, _templates/, NNN-feature/{spec,plan,tasks}.md
src/app/               rotas, layout, providers
src/features/<nome>/   components, hooks, api, schemas (uma pasta por feature)
src/lib/               supabase, money (centavos), dates, utils
api/                   Vercel Functions (chat)
supabase/migrations/   schema, RLS, funções, cron (versionadas)
scripts/check-specs.mjs  verificador de SDD (roda no CI)
```

## Convenções rápidas (detalhes na constituição)

- Código, nomes e commits em **inglês**; textos da interface em **pt-BR**.
- Commits: Conventional Commits com a tarefa, ex.: `feat(bills): add bill form (T-10)`.
- Validação com Zod, um schema por entidade, reutilizado em formulário, API e ferramentas do chat.
- Componentes de UI: shadcn/ui (`npx shadcn@latest add <componente>`), Tailwind.
- Uma tarefa = um PR pequeno.
