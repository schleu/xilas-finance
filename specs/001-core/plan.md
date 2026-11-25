# Plano técnico 001 — Núcleo do Xilas Finance

Deriva de `spec.md` v0.2 e `constitution.md`. Muda a spec? Atualize este plano.

## 1. Arquitetura

```
Browser (React SPA)
  ├─ Supabase JS (Auth + queries com JWT do usuário, protegidas por RLS)
  └─ POST /api/chat ──► Vercel Function ──► Provedor de LLM (API compatível com OpenAI)
                          └─ Supabase (com o JWT do usuário, nunca service_role)
Supabase: Postgres + Auth (convite) + pg_cron (geração de recorrências)
```

**Decisões**

| Tema | Decisão | Motivo |
|---|---|---|
| Build | Vite + React + TS, rotas com React Router | A stack pede só React; Vite é simples e a Vercel serve funções em `/api` |
| UI | shadcn/ui + Tailwind; gráficos com o componente `chart` do shadcn (Recharts) | Consistência e menos dependências |
| Dados no cliente | TanStack Query + `@supabase/supabase-js` | Cache e invalidação simples após escritas do chat ou manuais |
| Formulários | react-hook-form + Zod (`@hookform/resolvers`) | Constituição §6: schema único |
| Chat | Vercel Function `/api/chat` | Chaves de LLM só no servidor (§4) |
| LLM | Cliente único OpenAI-compatível, `baseURL`/modelo/chave por env | DeepSeek, OpenRouter e Together AI expõem essa API (§4a) |
| Recorrência | `pg_cron` no Supabase chamando função SQL idempotente | Roda mesmo sem ninguém logado; sem custo extra |
| Convites | Signups públicos desligados; convite via painel do Supabase (`inviteUserByEmail`) | Uso pessoal com poucos convidados |

## 2. Modelo de dados

Valores em centavos (inteiro). Todas as tabelas com `user_id` e RLS.

```sql
create type payment_type as enum ('pix', 'credit', 'debit');
create type bill_status  as enum ('pending', 'paid');

profiles(id uuid pk references auth.users, display_name text, created_at)

categories(
  id uuid pk, user_id uuid not null, name text not null,
  is_default bool default false, created_at,
  unique (user_id, lower(name))
)

recurring_rules(
  id uuid pk, user_id uuid not null,
  description text, company text, category_id uuid,
  amount_cents int, payment_type payment_type,
  bank text, agency text, account_number text,
  due_day smallint check (due_day between 1 and 31),
  start_month date, active bool default true, created_at
)

bills(
  id uuid pk, user_id uuid not null,
  description text not null, company text,
  category_id uuid not null references categories,
  amount_cents int not null check (amount_cents > 0),
  payment_type payment_type not null,
  bank text, agency text, account_number text,
  due_date date not null,
  status bill_status not null default 'pending',
  paid_at date,
  recurring_rule_id uuid references recurring_rules,
  created_at, updated_at,
  check (payment_type <> 'debit' or (bank is not null and agency is not null and account_number is not null)),
  check (status = 'paid' or paid_at is null),
  unique (recurring_rule_id, due_date)   -- idempotência da recorrência
)
```

- **Atrasado** não é coluna: `status = 'pending' and due_date < current_date`.
- `bills.recurring_rule_id` nulo = conta avulsa.
- Índices: `bills(user_id, due_date)`, `bills(user_id, category_id)`.

### Views/funções de leitura

- `monthly_summary(month)`: total pago, total pendente, qtd atrasados.
- `spending_by_category(from, to)`: soma de pagos por categoria.
- `monthly_evolution(months)`: soma de pagos por mês.

Usadas pela homepage **e** pelas ferramentas do chat, garantindo números iguais (spec US-4).

## 3. Segurança (RLS)

- Em todas as tabelas: `using (user_id = auth.uid()) with check (user_id = auth.uid())` para select/insert/update/delete.
- `profiles`: um usuário lê/edita só o próprio registro.
- Trigger `on auth.users insert` cria `profiles` e as 3 categorias padrão.
- Teste automatizado: usuário A não lê nem altera linhas do usuário B (obrigatório por tabela).
- Agência/conta: nunca em logs; máscara na UI; fora das colunas selecionadas pelas ferramentas do chat.

## 4. Recorrência

1. Ao salvar uma conta com `recurring = true`, o app cria uma `recurring_rule` e o primeiro `bill` ligado a ela.
2. Função SQL `generate_recurring_bills()`: para cada regra ativa, garante lançamentos pendentes do mês atual e dos 2 seguintes; `due_date` usa `least(due_day, último dia do mês)`; `insert ... on conflict (recurring_rule_id, due_date) do nothing`.
3. `pg_cron` roda a função diariamente; o app também a chama (RPC) logo após criar a regra.
4. Editar "este e os futuros": atualiza a regra e os `bills` pendentes futuros dela. Editar "só este": atualiza apenas o `bill`.
5. Encerrar: `active = false` e apaga `bills` pendentes futuros da regra.

## 5. Chatbot

**Fluxo**
1. Cliente envia histórico curto + mensagem para `/api/chat` com o JWT do Supabase.
2. A função valida o JWT, monta o prompt de sistema (data de hoje, categorias do usuário, regras de resposta) e chama o provedor com *tools*.
3. Ferramentas expostas ao modelo:
   - `propose_bill(campos)` → **não grava**; devolve um rascunho validado por Zod para o cliente mostrar como cartão de confirmação.
   - `list_bills(filtros)` → consulta com o JWT do usuário (RLS), colunas explícitas **sem** dados bancários.
   - `spending_report(from, to)` → usa `spending_by_category`.
4. Ao confirmar o rascunho, o **cliente** grava pelo mesmo hook/serviço do formulário manual (mesmo Zod, mesma RLS), e o TanStack Query invalida os dados.

**Provedor plugável**

```
LLM_PRIMARY_BASE_URL / LLM_PRIMARY_MODEL / LLM_PRIMARY_API_KEY
LLM_FALLBACK_BASE_URL / LLM_FALLBACK_MODEL / LLM_FALLBACK_API_KEY   (opcional)
```

- Tenta o primário; em erro 429/5xx/timeout, tenta o reserva; sem reserva, devolve erro amigável.
- **Risco:** modelos gratuitos podem não suportar *tool calling* bem. Mitigação: modo alternativo com saída JSON validada por Zod e uma nova tentativa com a mensagem de erro de validação. A tarefa T-18 é um *spike* para decidir.
- Limite por usuário (ex.: N mensagens/hora) na função para não estourar a cota gratuita.

## 6. Estrutura de pastas

```
src/
  app/            rotas, layout, providers
  features/
    auth/  dashboard/  bills/  categories/  chat/
      components/  hooks/  api/  schemas/
  lib/            supabase client, formatação de moeda/data, utils
api/
  chat.ts         Vercel Function
  _llm/           provider, tools, prompts
supabase/
  migrations/     schema, RLS, funções, cron
  tests/          testes de RLS (pgTAP ou scripts)
specs/            constitution, spec, plan, tasks
```

## 7. Ambientes e deploy

- GitHub → Vercel: preview por PR, produção na `main`.
- Supabase: um projeto de desenvolvimento e um de produção; migrações via Supabase CLI.
- Variáveis na Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (públicas); `LLM_*` e, se necessário, `SUPABASE_URL`/`SUPABASE_ANON_KEY` da função (privadas).
- CI no GitHub Actions: typecheck, lint, testes e verificação das migrações.

## 8. Mapeamento spec → plano

| Spec | Onde é atendida |
|---|---|
| US-0 | Auth por convite, trigger de perfil/categorias, RLS (§3) |
| US-1 | Funções de leitura (§2), feature `dashboard` |
| US-2 / US-5 | Tabela `bills`, feature `bills`, Zod compartilhado |
| US-2b | `recurring_rules` + `generate_recurring_bills()` (§4) |
| US-3 | Tabela `categories`, feature `categories` |
| US-4 | `/api/chat`, ferramentas e provedor plugável (§5) |
