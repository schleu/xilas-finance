---
description: Implementar uma tarefa do SDD (passo 4)
argument-hint: <T-NN> (opcional; sem argumento, a próxima tarefa liberada)
---

Leia `AGENTS.md` e `specs/constitution.md`.

Tarefa: $ARGUMENTS (se vazio, escolha a próxima tarefa não concluída cujas dependências estão prontas).

1. Abra `tasks.md`, `spec.md` e `plan.md` da feature. Confirme o portão: spec `aprovada`, ou tarefa da Fase 0.
2. Resuma em 3 linhas o que será feito e quais critérios de aceite a tarefa atende. Se houver dúvida, pare e pergunte.
3. Escreva os testes primeiro, depois implemente o mínimo. Sem escopo extra.
4. Rode `npm run check` até ficar verde.
5. Marque `[x]` na tarefa em `tasks.md`; atualize spec/plan se algo mudou (com linha no Histórico).
6. Entregue com a mensagem de commit `tipo(escopo): resumo (T-NN)` e os campos `Spec:` e `Task:` para o PR.
