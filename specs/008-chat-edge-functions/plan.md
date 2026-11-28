# Plano técnico 008 — Chat via Supabase Edge Functions

Deriva de `spec.md` e `specs/constitution.md`.

## 1. Arquitetura e decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Runtime do chat | Criar `supabase/functions/chat/index.ts` (Deno) com suporte a CORS (`OPTIONS`, `GET`, `POST`). | Executa o chat diretamente na infraestrutura Supabase Edge Functions. |
| Catálogo padrão OpenRouter | Definir lista padrão com os 7 modelos gratuitos usando `https://openrouter.ai/api/v1` e secret `OPENROUTER_API_KEY`, com override opcional via `FINANCE_LLM_MODELS`. | Mantém plugabilidade de provedor (Princípio 4a) e facilita atualização de modelos gratuitos. |
| Fallback resiliente | Em caso de erro retryable (429, 5xx, timeout/rede), percorrer os demais modelos do catálogo até obter resposta ou esgotar opções. | Modelos gratuitos sofrem rate limit frequente; tentar mais de um fallback aumenta disponibilidade. |
| Cliente frontend | Atualizar `src/features/chat/api/chatApi.ts` para chamar `${VITE_FINANCE_SUPABASE_URL}/functions/v1/chat` com `Authorization: Bearer <accessToken>` e `apikey: <anonKey>`. | Compatível com `GET` (modelos) e `POST` (mensagens) usando o token da sessão atual. |

## 2. Modelo de dados

Sem alterações de schema no Postgres. Reutiliza tabelas e RPCs existentes (`categories`, `stores`, `income_types`, `bills`, `incomes`, `monthly_summary`, `spending_by_category`, `monthly_evolution`).

## 3. Segurança (RLS)

- O cliente Supabase dentro da Edge Function é instanciado com `SUPABASE_URL`, `SUPABASE_ANON_KEY` e header `Authorization: Bearer <jwt>`.
- `supabase.auth.getUser(jwt)` valida a sessão antes de qualquer operação.
- Nenhuma operação de escrita é executada pela Edge Function (ferramentas `propose_bill` e `propose_income` apenas devolvem o rascunho validado para confirmação na UI).

## 4. Contratos (API, funções, ferramentas)

- `GET /functions/v1/chat` → `200 { models: Array<{ id, label, isDefault }> }`
- `POST /functions/v1/chat` → body `{ messages, modelId? }` → `200 { reply, proposedBill?, proposedIncome?, usedFallback, modelId }`
- Secrets server-side: `OPENROUTER_API_KEY` (obrigatório quando `FINANCE_LLM_MODELS` não está definido), `FINANCE_LLM_MODELS` (opcional).

## 5. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Bloqueio de CORS no navegador | Responder `OPTIONS` com status `204` e cabeçalhos `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers` e `Access-Control-Allow-Methods`. |
| Indisponibilidade simultânea de modelos gratuitos | Fallback em cadeia pelo catálogo + mensagem amigável sem travar uso manual do app. |

## 6. Mapeamento spec → plano

| Spec | Onde é atendida |
|---|---|
| US-1 | `supabase/functions/chat/*`, `src/features/chat/api/chatApi.ts`, `src/features/chat/components/ChatPage.tsx` |
