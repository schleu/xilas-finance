# Plano técnico 004 — Chat v2 (Seletor de LLM e Histórico de Conversas)

Deriva de `spec.md` v0.1 e `specs/constitution.md`.

## 1. Arquitetura e decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Catálogo de LLMs | Env var opcional `FINANCE_LLM_MODELS` (JSON array de `{ id, label, baseUrl, model, apiKey }`) + retrocompatibilidade com `FINANCE_LLM_PRIMARY_*` / `FINANCE_LLM_FALLBACK_*` | Permite múltiplos modelos pré-configurados sem quebrar configuração atual da `001-core` |
| Descoberta de modelos | `GET /api/chat` retorna `{ models: [{ id, label, isDefault }] }` (requer JWT válido) | Evita criar nova Vercel Function desnecessária e nunca expõe chaves/URLs |
| Persistência do chat | Tabelas `chat_conversations` e `chat_messages` no Supabase, escritas pelo cliente autenticado (via RLS) ou via `/api/chat` com JWT do usuário | Mesmo padrão de segurança com JWT do usuário (nunca `service_role`) |
| Regra "conversa do dia" | Coluna `conversation_date date` (no fuso `America/Fortaleza`) em `chat_conversations` | Consulta simples e indexada: `where conversation_date = todayIso order by updated_at desc limit 1` |
| UI de histórico | Drawer/sidebar colapsável na `ChatPage` + botão "Nova conversa" e `<Select>` de modelo no cabeçalho do chat | Mobile-first e mantém o foco limpo na conversa do dia |

## 2. Modelo de dados

```sql
create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null check (char_length(btrim(title)) > 0),
  conversation_date date not null,
  model_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_conversations_user_date_idx
  on public.chat_conversations (user_id, conversation_date desc, updated_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model_id text,
  used_fallback boolean not null default false,
  proposed_bill jsonb,
  created_at timestamptz not null default now()
);

create index chat_messages_conversation_idx
  on public.chat_messages (conversation_id, created_at asc);
```

## 3. Segurança (RLS)

- RLS habilitada em `chat_conversations` e `chat_messages`.
- Políticas `select`, `insert`, `update`, `delete` exigindo `user_id = (select auth.uid())`.
- Em `chat_messages`, política de `insert` também verifica que `conversation_id` pertence ao `auth.uid()`.
- Teste pgTAP em `supabase/tests/06_chat_history_rls.sql` garantindo isolamento total entre usuários.
- `GET /api/chat` exige `Authorization: Bearer <jwt>` válido e retorna apenas `{ id, label, isDefault }`.

## 4. Contratos (API, funções, ferramentas)

- `GET /api/chat` (autenticado): retorna `{ models: Array<{ id: string; label: string; isDefault: boolean }> }`.
- `POST /api/chat` (autenticado): aceita `{ messages, modelId?: string }`; seleciona o provedor correspondente a `modelId` (ou `primary` se omitido), mantendo fallback em 429/5xx/timeout. Retorna `{ reply, proposedBill, usedFallback, modelId }`.
- `src/features/chat/api/chatHistory.ts` + hooks TanStack Query:
  - `useTodayConversation()` — busca a conversa mais recente de `todayIsoFortaleza()`.
  - `useChatConversations()` — lista conversas para o painel de histórico.
  - `useConversationMessages(conversationId)` — carrega mensagens da conversa ativa.
  - `useCreateConversation()`, `useSaveChatMessages()`, `useDeleteConversation()`.

## 5. Riscos e mitigações

- **JSON malformado em `FINANCE_LLM_MODELS`:** mitigado com validação Zod no servidor e fallback automático para `FINANCE_LLM_PRIMARY_*`.
- **Conversa com rascunho `proposed_bill` já salvo:** o cartão de confirmação exibe estado persistido/neutro ao revisitar histórico para evitar salvamento duplicado acidental.

## 6. Mapeamento spec → plano

| Spec | Onde é atendida |
|---|---|
| US-1 | `api/_llm/provider.ts` (catálogo de modelos), `GET`/`POST /api/chat` e seletor em `ChatPage` |
| US-2 | Migração `chat_conversations`/`chat_messages` + RLS + hooks de histórico + drawer e botão "Nova conversa" em `ChatPage` |
