---
description: Criar ou atualizar a spec de uma feature (SDD, passo 1)
argument-hint: <descrição da feature ou mudança>
---

Leia `AGENTS.md` e `specs/constitution.md`.

Pedido: $ARGUMENTS

1. Descubra se já existe uma feature em `specs/NNN-*/` para isso. Se sim, edite a `spec.md` dela; se não, crie `specs/NNN-nome/spec.md` (próximo número livre) a partir de `specs/_templates/spec-template.md`.
2. Escreva apenas **o quê e por quê**: user stories e critérios de aceite verificáveis. Nada de tecnologia ou arquitetura.
3. Para tudo que for ambíguo, use `[NEEDS CLARIFICATION: pergunta]` e liste em "Perguntas em aberto". Não invente requisitos.
4. Mantenha `**Status:** rascunho` e acrescente uma linha ao `## Histórico`.
5. Pare e peça aprovação humana. Não gere plano, tarefas nem código nesta etapa.
