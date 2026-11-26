# Xilas Finance

Controle financeiro pessoal: contas, categorias, recorrência automática, resumo mensal com gráficos e chatbot em linguagem natural para adicionar e consultar gastos.

**Stack:** React, TypeScript (strict), Tailwind, shadcn/ui, TanStack Query, Zod, Supabase (Postgres + Auth por convite + RLS + pg_cron) · **Deploy:** Vercel · **Código:** GitHub

## Spec-Driven Development (SDD)

Nada é implementado sem spec aprovada e tarefa. Leia nesta ordem:

1. [`specs/constitution.md`](specs/constitution.md): princípios
2. [`specs/001-core/spec.md`](specs/001-core/spec.md): o quê e por quê
3. [`specs/001-core/plan.md`](specs/001-core/plan.md): arquitetura, modelo de dados e contratos
4. [`specs/001-core/tasks.md`](specs/001-core/tasks.md): tarefas e progresso
5. [`AGENTS.md`](AGENTS.md): regras para agents e humanos
6. [`specs/README.md`](specs/README.md): ciclo de vida das specs

## Setup local

Pré-requisitos: Node.js `>= 20` e Docker (para rodar o Supabase local).

```bash
npm install
cp .env.example .env.local   # preencha as variáveis abaixo
npm run db:start             # sobe o Supabase local (Postgres, Auth, Studio)
npm run db:reset             # aplica todas as migrações em supabase/migrations/
npm run dev                  # inicia o app em http://localhost:5173
```

### Comandos úteis

```bash
npm run check                # specs + typecheck + lint + testes (Vitest)
npm run check:specs          # valida a estrutura e portões do SDD
npm run build                # typecheck + build de produção
npx supabase test db         # executa a suíte pgTAP (RLS, funções e recorrência)
npm run db:lint              # valida o schema SQL
npm run db:push              # aplica migrações no projeto Supabase remoto
```

Para adicionar componentes shadcn/ui: `npx shadcn@latest add <componente>`.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` (desenvolvimento) e configure as mesmas chaves na Vercel (Preview e Production).

### Cliente (públicas — prefixo `VITE_`)

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave pública `anon` do Supabase (segurança garantida por RLS) |

### Servidor (Vercel Functions `/api/chat` — **nunca** use `VITE_`)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SUPABASE_URL` | Sim | URL do projeto Supabase usada por `/api/chat` |
| `SUPABASE_ANON_KEY` | Sim | Chave `anon` usada junto ao JWT do usuário autenticado (nunca `service_role`) |
| `LLM_PRIMARY_BASE_URL` | Sim | Endpoint OpenAI-compatível (ex.: `https://openrouter.ai/api/v1`, `https://api.deepseek.com/v1`, `https://api.together.xyz/v1`) |
| `LLM_PRIMARY_MODEL` | Sim | Identificador do modelo primário (ex.: `meta-llama/llama-3.3-70b-instruct:free`) |
| `LLM_PRIMARY_API_KEY` | Sim | Chave da API do provedor primário |
| `LLM_FALLBACK_BASE_URL` | Não | Endpoint do provedor reserva acionado em erro `429`, `5xx` ou timeout |
| `LLM_FALLBACK_MODEL` | Não | Modelo do provedor reserva |
| `LLM_FALLBACK_API_KEY` | Não | Chave da API do provedor reserva |
| `CHAT_RATE_LIMIT_MAX` | Não | Limite de mensagens por usuário na janela (padrão: `20`) |
| `CHAT_RATE_LIMIT_WINDOW_MS` | Não | Duração da janela de rate limit em ms (padrão: `3600000` = 1h) |

> **Nunca** exponha `service_role` ou chaves de LLM no cliente, nem versione `.env` ou `.env.local`.

## Como convidar usuários

O Xilas Finance usa **acesso exclusivamente por convite** (cadastro público desabilitado):

1. No painel do Supabase, vá em **Authentication → Providers → Email** e mantenha **Allow new users to sign up** desativado (no local, configurado em `supabase/config.toml`).
2. Em **Authentication → URL Configuration**, garanta que a URL da aplicação (ex.: `https://xilas-finance.vercel.app`) esteja em **Site URL** e em **Redirect URLs**.
3. Em **Authentication → Users**, clique em **Invite user** e informe o e-mail da pessoa convidada.
4. Ao abrir o link do e-mail, o usuário é direcionado automaticamente para `/definir-senha`, define sua senha e recebe as 3 categorias padrão (**Fixa**, **Variável**, **Cartão de Crédito**) via trigger no Postgres.

## Segurança e proteções automáticas

- **RLS ativa em todas as tabelas** (`profiles`, `categories`, `bills`, `recurring_rules`), verificada por testes pgTAP (`supabase/tests/`) e auditoria automatizada (`api/securityAudit.test.ts`).
- **Dados bancários protegidos:** banco, agência e conta são mascarados na listagem, nunca registrados em logs e nunca selecionados ou enviados ao LLM.
- **Confirmação explícita no chat:** o assistente apenas propõe rascunhos validados com Zod (`propose_bill`); a gravação só ocorre no cliente após confirmação do usuário.
- **CI / SDD PR:** `npm run check` e o workflow `SDD PR` validam tipos, lint, testes e atualização de `tasks.md` em todo Pull Request.
