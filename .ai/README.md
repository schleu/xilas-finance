# Specs — Spec-Driven Development

Aqui mora a fonte da verdade do Xilas Finance.

```
specs/
  constitution.md        princípios do projeto (muda raramente, só com aprovação humana)
  _templates/            modelos de spec, plano e tarefas
  001-core/              uma pasta por feature: NNN-nome
    spec.md              o quê e por quê
    plan.md              como
    tasks.md             passos pequenos e verificáveis
```

## Ciclo de vida

```
ideia → spec (rascunho) → [aprovação humana] → plan → tasks → implementação → spec (implementada)
```

| Etapa | Artefato | Quem decide |
|---|---|---|
| 1. Especificar | `spec.md` com user stories e critérios de aceite | humano aprova (`Status: aprovada`) |
| 2. Planejar | `plan.md` (arquitetura, dados, RLS, contratos) | humano revisa |
| 3. Quebrar | `tasks.md` (`T-NN`, dependências, critério de pronto) | humano revisa |
| 4. Implementar | código + testes, uma tarefa por PR | CI (`check`) + revisão |

## Regras

- **Status da spec:** `rascunho`, `aprovada` ou `implementada`. Só a Fase 0 (infra) avança com spec em rascunho.
- **Ambiguidade:** marque `[NEEDS CLARIFICATION: ...]` e pergunte; não invente.
- **Mudou o comportamento?** Atualize a spec antes do código e registre em `## Histórico`.
- **Numeração:** features `NNN-nome` (001, 002...); tarefas `T-NN` únicas por feature.
- **Formato de tarefa** (validado por `npm run check:specs`):
  `- [ ] **T-12 Título.** Descrição. *Dep:* T-09. *Pronto:* critério verificável.`

## Como começar uma feature nova

1. `/specify <descrição>` (Claude Code) ou copie `_templates/spec-template.md` para `specs/NNN-nome/spec.md`.
2. Responda as perguntas em aberto e aprove (`Status: aprovada`).
3. `/plan NNN-nome` → `/tasks NNN-nome`.
4. `/implement T-NN`, uma tarefa por vez.
