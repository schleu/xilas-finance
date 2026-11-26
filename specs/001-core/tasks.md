# Tarefas 001 — Núcleo do Xilas Finance

Cada tarefa cabe em um PR pequeno. "Pronto" = critério verificável + definição de pronto da constituição.
`[P]` = pode ser feita em paralelo com outras da mesma fase. `Dep:` = depende de.

## Fase 0 — Fundação

- [x] **T-01 Repositório e projeto base.** Vite + React + TS strict, Tailwind, shadcn/ui, ESLint, Prettier. *Pronto:* `npm run build` e `lint` passam.
- [x] **T-02 CI e deploy.** GitHub Actions (typecheck, lint, teste) e projeto na Vercel com preview por PR. *Dep:* T-01. *Pronto:* PR de teste gera preview. (Validado no PR #1: workflows `ci.yml`/`sdd-pr.yml`, preview da Vercel e produção em https://xilas-finance.vercel.app.)
- [x] **T-03 Supabase (dev e prod) + CLI.** Projetos criados, `supabase/migrations` versionado, variáveis na Vercel. *Pronto:* migração vazia aplica em dev. (Projeto dev `xilas-finance` linkado, CLI/config versionados e migração `20261126110237_init.sql` aplicada. Decisão de 26/11: manter um projeto por enquanto; produção será criada quando houver uso real.)
- [x] **T-04 Utilitários.** Formatação de moeda BRL (centavos), datas, cliente Supabase. *Dep:* T-01. *Pronto:* testes unitários da formatação.

## Fase 1 — Acesso e categorias (US-0, US-3)

- [x] **T-05 Migração: profiles, categories, RLS e trigger.** Perfil e 3 categorias padrão na criação do usuário. *Dep:* T-03. *Pronto:* teste de RLS (A não vê B) e categorias padrão criadas.
- [x] **T-06 Auth por convite.** Desligar signup público, tela de login, rota protegida, logout. *Dep:* T-04, T-05. *Pronto:* sem sessão redireciona ao login; convite por e-mail funciona.
- [x] **T-07 [P] CRUD de categorias (UI).** Criar, renomear, excluir; bloqueio/reatribuição se em uso; unicidade case-insensitive. *Dep:* T-06. *Pronto:* critérios de US-3.

## Fase 2 — Contas (US-2, US-5)

- [x] **T-08 Migração: bills + enums + checks + RLS + índices.** *Dep:* T-05. *Pronto:* teste de RLS; check de débito exige banco/agência/conta.
- [x] **T-09 Schema Zod e serviço de contas.** Schema único (regras da US-2), hooks TanStack Query (listar, criar, editar, excluir, marcar como pago). *Dep:* T-08. *Pronto:* testes unitários do schema.
- [x] **T-10 Formulário de conta.** Campos condicionais de débito, erros por campo, valor em BRL. *Dep:* T-09, T-07. *Pronto:* critérios de cadastro da US-2.
- [x] **T-11 Lista de contas.** Filtros por mês, categoria, status e atrasadas; máscara de agência/conta; "marcar como pago" em um clique; exclusão com confirmação. *Dep:* T-09. *Pronto:* critérios da US-5.

## Fase 3 — Homepage (US-1)

- [x] **T-12 Migração: funções de leitura.** `monthly_summary`, `spending_by_category`, `monthly_evolution` (somente pagos; pendentes à parte). *Dep:* T-08. *Pronto:* testes SQL com dados de exemplo.
- [x] **T-13 Cards e navegação de mês.** Total gasto, total pendente, qtd atrasados. *Dep:* T-12, T-11.
- [x] **T-14 [P] Gráficos.** Gasto por categoria e evolução de 6 meses (shadcn chart). *Dep:* T-12.
- [x] **T-15 [P] Próximos vencimentos e estado vazio.** *Dep:* T-11. *Pronto:* critérios da US-1.

## Fase 4 — Recorrência (US-2b)

- [x] **T-16 Migração: recurring_rules + `generate_recurring_bills()` + pg_cron.** Idempotente, ajuste de dia 31, mês atual + 2 seguintes. *Dep:* T-08. *Pronto:* testes SQL (idempotência, fevereiro, regra inativa).
- [x] **T-17 UI de recorrência.** Opção "recorrente" no formulário, escolha "só este / este e futuros", encerrar recorrência. *Dep:* T-16, T-10. *Pronto:* critérios da US-2b.

## Fase 5 — Chatbot (US-4)

- [x] **T-18 Spike: provedores gratuitos.** Testar DeepSeek, OpenRouter e Together AI com tool calling e com JSON+Zod; escolher estratégia e modelo primário/reserva. *Pronto:* nota curta em `specs/001-core/research-llm.md`.
- [x] **T-19 Camada de provedor.** Cliente OpenAI-compatível por env, fallback em 429/5xx/timeout, erro amigável. *Dep:* T-18. *Pronto:* testes com provedor simulado.
- [x] **T-20 `/api/chat` + validação de JWT + limite por usuário.** *Dep:* T-19, T-06.
- [ ] **T-21 Ferramenta `list_bills`.** Colunas explícitas sem dados bancários, via JWT do usuário. *Dep:* T-20, T-08. *Pronto:* teste garante que banco/agência/conta nunca vão ao LLM.
- [ ] **T-22 Ferramenta `spending_report`.** Usa `spending_by_category`; números iguais aos da homepage. *Dep:* T-20, T-12.
- [ ] **T-23 `propose_bill` + cartão de confirmação.** Rascunho validado por Zod, bot pergunta só o que falta, cliente grava pelo mesmo serviço da T-09 após confirmar. *Dep:* T-20, T-09.
- [ ] **T-24 UI do chat.** Janela de conversa, estados de carregamento/erro, invalidação de cache após salvar. *Dep:* T-21, T-22, T-23. *Pronto:* critérios da US-4.

## Fase 6 — Fechamento

- [ ] **T-25 Testes e2e dos fluxos principais.** Login por convite, criar conta, marcar pago, recorrência, chat adicionar/listar. *Dep:* fases 1–5.
- [ ] **T-26 Revisão de segurança.** RLS em todas as tabelas, nenhum dado bancário em logs/LLM, chaves só no servidor. *Dep:* fases 1–5.
- [ ] **T-27 Acessibilidade e responsivo.** Mobile-first, teclado, contraste. *Dep:* fases 2–5.
- [ ] **T-28 Documentação.** README com setup, variáveis de ambiente e como convidar usuários.

## Ordem sugerida

`T-01 → T-02/T-03/T-04 → T-05 → T-06 → T-07 → T-08 → T-09 → T-10/T-11 → T-12…T-15 → T-16/T-17 → T-18…T-24 → T-25…T-28`

O spike T-18 pode ser adiantado e feito em paralelo à Fase 1, já que ele define o risco principal do chatbot.
