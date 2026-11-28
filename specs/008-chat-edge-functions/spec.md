# Spec 008 — Chat via Supabase Edge Functions

**Status:** implementada · **Versão:** 0.1 · **Foco:** o quê e por quê (sem decisões de implementação)

## Objetivo

Migrar o backend do assistente de chat financeiro para **Supabase Edge Functions** e disponibilizar um catálogo atualizado de modelos gratuitos do OpenRouter, mantendo segurança (JWT + RLS), plugabilidade de provedor e confirmação obrigatória do usuário antes de qualquer gravação.

## Escopo

**Dentro:**
- Nova Supabase Edge Function `chat` atendendo listagem de modelos (`GET`) e envio de mensagens (`POST`).
- Catálogo padrão com modelos gratuitos do OpenRouter:
  - `openrouter/free`
  - `google/gemma-4-31b-it:free`
  - `google/gemma-4-26b-a4b-it:free`
  - `inclusionai/ling-3.2-flash:free`
  - `nvidia/nemotron-3.5-super-vl:free`
  - `baidu/ernie-5.5-flash-preview:free`
  - `nvidia/nemotron-3.5-lightning:free`
- Atualização do frontend de Chat para consumir a Edge Function com autenticação JWT da sessão.
- Fallback automático entre modelos em caso de rate limit (429), erro 5xx ou timeout.

**Fora:**
- Alteração no fluxo de histórico de conversas (`chat_sessions`/`chat_messages`).
- Remoção de confirmação explícita para gravação de despesas/rendas pelo assistente.

## US-1 — Assistente de chat operando via Supabase Edge Functions

Como usuário, quero conversar com o assistente financeiro usando Supabase Edge Functions e escolher entre modelos gratuitos do OpenRouter.

**Critérios de aceite**
- [ ] O frontend consulta modelos (`GET`) e envia mensagens (`POST`) diretamente para a Supabase Edge Function `chat`, enviando o JWT da sessão no cabeçalho `Authorization`.
- [ ] A Edge Function valida o JWT do usuário e executa todas as consultas de leitura respeitando RLS (`SECURITY INVOKER` / cliente com JWT do usuário).
- [ ] A Edge Function mantém rate limiting por usuário e nunca grava dados no banco sem confirmação explícita do usuário na UI.
- [ ] O catálogo padrão expõe os 7 modelos gratuitos do OpenRouter configurados (com `openrouter/free` como padrão), podendo ser sobrescrito por configuração server-side sem alteração de código (Constituição 4a).
- [ ] Em caso de erro 429, 5xx ou timeout no modelo escolhido, o servidor tenta fallback automático para o próximo modelo disponível e, se todos falharem, retorna mensagem amigável em pt-BR.
- [ ] Nenhuma chave de LLM ou `service_role` é exposta no bundle do cliente.

## Requisitos não funcionais

- **Privacidade/segurança:** chaves de API ficam exclusivamente em secrets da Supabase Edge Function; dados bancários sensíveis nunca são enviados ao LLM.
- **Desempenho:** timeout por tentativa de chamada ao provedor de LLM (15s) com fallback rápido.

## Premissas adotadas

1. A migração mantém o Princípio 4 da constituição (chaves somente no servidor, nunca no cliente), movendo o segredo do provedor de LLM para os secrets da Supabase Edge Function.

## Histórico

- 0.1 — Rascunho inicial separado da proposta unificada.
