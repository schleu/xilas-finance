# Tarefas 004 — Chat v2 (Seletor de LLM, Histórico do Dia e Cadastro Inteligente)

Cada tarefa cabe em um PR pequeno. `[P]` = pode rodar em paralelo. `Dep:` = depende de.

## Fase 1 — Catálogo de LLMs no servidor (US-1)

- [x] **T-01 Suporte a múltiplos modelos pré-configurados em `api/_llm/provider.ts`.** Carregar catálogo a partir de `FINANCE_LLM_MODELS` (com fallback retrocompatível para `FINANCE_LLM_PRIMARY_*` / `FINANCE_LLM_FALLBACK_*`), validar com Zod e resolver modelo escolhido mantendo fallback em 429/5xx/timeout. *Pronto:* testes unitários cobrindo seleção de modelo, ID inválido e fallback.
- [x] **T-02 Expor `GET /api/chat` (lista de modelos) e `modelId` em `POST /api/chat`.** Validar JWT em `GET /api/chat`, retornar apenas `{ id, label, isDefault }` (nunca chaves/URLs) e aceitar `modelId` opcional no `POST`. *Dep:* T-01. *Pronto:* testes em `api/chat.test.ts` e `api/securityAudit.test.ts`.

## Fase 2 — Persistência e RLS do histórico (US-2)

- [x] **T-03 Migração `chat_conversations` e `chat_messages` + RLS.** Criar tabelas, índices e políticas RLS (incluindo verificação de posse da conversa ao inserir mensagens). *Pronto:* teste pgTAP provando isolamento entre usuários.
- [x] **T-04 API cliente e hooks TanStack Query de histórico.** Implementar busca da conversa ativa do dia (`America/Fortaleza`), listagem do histórico, criação de conversa, gravação de mensagens e exclusão. *Dep:* T-03. *Pronto:* testes unitários dos hooks/serviços.

## Fase 3 — Cadastro inteligente e Interface do Chat v2 (US-1, US-2, US-3)

- [x] **T-05 Aprimorar prompt e `propose_bill` com lojas cadastradas e recorrência.** Incluir nomes/IDs das lojas do usuário no prompt do sistema (sem dados bancários), mapear `store_id`/`company` em `propose_bill` e validar os 3 cenários da US-3 (campos faltantes, recorrência, compra em loja cadastrada). *Dep:* T-02. *Pronto:* testes unitários em `api/_llm/tools.test.ts` cobrindo os cenários da US-3.
- [x] **T-06 Seletor de LLM, conversa do dia, "Nova conversa" e drawer de histórico na `ChatPage`.** Integrar seletor de modelo pré-configurado, carregamento exclusivo da conversa de hoje por padrão, botão "Nova conversa" e painel colapsável para abrir/excluir conversas anteriores. *Dep:* T-04, T-05. *Pronto:* testes de componente cobrindo US-1, US-2 e US-3 e `npm run check` verde.
