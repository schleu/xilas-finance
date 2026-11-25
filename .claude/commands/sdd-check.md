---
description: Auditar se o repositório respeita o SDD
---

1. Rode `npm run check:specs` e relate o resultado.
2. Compare o código em `src/`, `api/` e `supabase/` com `specs/*/spec.md` e `plan.md`: liste comportamentos implementados sem spec, critérios de aceite sem teste e divergências entre plano e código.
3. Liste tarefas marcadas `[x]` cujos critérios de "Pronto" não se verificam no código.
4. Não corrija nada; apenas reporte, em ordem de gravidade.
