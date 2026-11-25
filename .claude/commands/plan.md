---
description: Gerar ou atualizar o plano técnico de uma feature (SDD, passo 2)
argument-hint: <NNN-feature>
---

Leia `AGENTS.md`, `specs/constitution.md` e `specs/$ARGUMENTS/spec.md`.

1. Confirme que a spec não tem `[NEEDS CLARIFICATION]` aberto. Se tiver, pare e pergunte.
2. Crie ou atualize `specs/$ARGUMENTS/plan.md` a partir de `specs/_templates/plan-template.md`: arquitetura, modelo de dados, RLS, contratos e riscos.
3. Inclua uma tabela de mapeamento spec → plano cobrindo **todas** as user stories.
4. Respeite a constituição; se uma decisão exigir exceção, destaque e peça aprovação.
5. Não escreva código nem tarefas nesta etapa.
