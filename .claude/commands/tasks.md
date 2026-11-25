---
description: Quebrar o plano em tarefas pequenas (SDD, passo 3)
argument-hint: <NNN-feature>
---

Leia `AGENTS.md`, `specs/$ARGUMENTS/spec.md` e `specs/$ARGUMENTS/plan.md`.

Crie ou atualize `specs/$ARGUMENTS/tasks.md` a partir de `specs/_templates/tasks-template.md`:
- Formato obrigatório: `- [ ] **T-NN Título.** Descrição. *Dep:* T-XX. *Pronto:* critério verificável.`
- Agrupe em fases (`## Fase 0 — Fundação`, ...). Fase 0 é só infraestrutura.
- Cada tarefa cabe em um PR pequeno e aponta o critério de aceite da spec que atende.
- Toda US da spec deve ser coberta por pelo menos uma tarefa.
Rode `npm run check:specs` ao final.
