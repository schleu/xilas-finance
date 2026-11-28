# Tarefas 008 — Chat via Supabase Edge Functions

Cada tarefa cabe em um PR pequeno. `[P]` = pode rodar em paralelo. `Dep:` = depende de.
Formato obrigatório: `- [ ] **T-NN Título.** Descrição. *Dep:* T-XX. *Pronto:* critério verificável.`

## Fase 1 — Edge Function e catálogo OpenRouter

- [x] **T-01 Criar módulo de provedor e catálogo OpenRouter para Edge Function.** Implementar catálogo padrão com os 7 modelos gratuitos do OpenRouter, override via `FINANCE_LLM_MODELS` e fallback sequencial + testes unitários. *Pronto:* testes cobrem seleção de modelo, override e fallback em 429/5xx/timeout.
- [x] **T-02 Implementar Supabase Edge Function `chat`.** Criar `supabase/functions/chat/index.ts` com CORS, validação de JWT, RLS, rate limit por usuário, prompts e ferramentas de leitura/proposta. *Dep:* T-01. *Pronto:* Edge Function completa e validada com testes do handler.

## Fase 2 — Integração no frontend

- [x] **T-03 Conectar `chatApi.ts` e `ChatPage.tsx` à Edge Function.** Atualizar `src/features/chat/api/chatApi.ts` para chamar `/functions/v1/chat` (GET e POST) com `Authorization` e `apikey`, atualizando testes em `ChatPage.test.tsx`. *Dep:* T-02. *Pronto:* critérios da US-1 verificados em `ChatPage.test.tsx` e `npm run check` verde.
