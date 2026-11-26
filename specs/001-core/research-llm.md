# Pesquisa de Provedores de LLM (Spike T-18)

Referência: `specs/001-core/spec.md` (US-4), `specs/001-core/plan.md` (§5) e `specs/constitution.md` (§4, §4a, §5).

## Objetivo

Definir a estratégia de integração do chatbot `/api/chat` com provedores gratuitos/acessíveis compatíveis com a API OpenAI (`POST /chat/completions`), garantindo portabilidade sem acoplamento a um único fornecedor.

## Comparativo de provedores avaliados

| Provedor | Base URL (OpenAI-compatível) | Modelos típicos | Tool calling nativo | Limites / riscos da camada gratuita |
|---|---|---|---|---|
| **OpenRouter** | `https://openrouter.ai/api/v1` | `meta-llama/llama-3.3-70b-instruct:free`, `qwen/qwen-2.5-72b-instruct:free`, `deepseek/deepseek-chat-v3-0324:free` | Sim (varia por modelo gratuito) | Cota diária/RPM variável; erros `429` e `503` ocasionais em horários de pico |
| **DeepSeek** | `https://api.deepseek.com/v1` | `deepseek-chat` | Sim (estável) | Sem tier gratuito permanente (crédito inicial/baixo custo); pode sofrer latência alta |
| **Together AI** | `https://api.together.xyz/v1` | `meta-llama/Llama-3.3-70B-Instruct-Turbo-Free`, `Qwen/Qwen2.5-72B-Instruct-Turbo` | Sim (parcial em modelos free) | Rate limit rigoroso por minuto em modelos `:Free` |

## Estratégia escolhida

1. **Cliente único OpenAI-compatível via `fetch` (sem SDK proprietário):**
   - Configurado exclusivamente por variáveis de ambiente no servidor (`LLM_PRIMARY_BASE_URL`, `LLM_PRIMARY_MODEL`, `LLM_PRIMARY_API_KEY` e par opcional `LLM_FALLBACK_*`).
   - Timeout explícito por requisição (`AbortController`, padrão 15 s) para não prender a Vercel Function.
2. **Tool calling nativo com fallback JSON + Zod:**
   - O cliente envia `tools` no formato OpenAI (`propose_bill`, `list_bills`, `spending_report`).
   - Como alguns modelos gratuitos ignoram `tool_calls` ou devolvem JSON em texto puro, o parser aceita tanto `message.tool_calls` quanto um bloco JSON estruturado validado com Zod; se a validação falhar, devolve a mensagem de erro ao modelo em 1 nova tentativa antes de responder ao usuário.
   - Em qualquer caso, **`propose_bill` nunca grava no banco**: retorna um rascunho validado pelo mesmo `billSchema` (Zod) para confirmação explícita do usuário na UI.
3. **Fallback automático entre provedores:**
   - Em erro `429` (rate limit), `5xx` ou `timeout`/erro de rede no provedor primário, o cliente aciona automaticamente o provedor reserva (`LLM_FALLBACK_*`), quando configurado.
   - Sem reserva disponível ou se ambos falharem, retorna erro amigável em pt-BR (`503`) sem quebrar o restante do aplicativo.

## Configuração recomendada

- **Primário:** OpenRouter (`https://openrouter.ai/api/v1`, modelo `:free` com suporte a tools, ex.: `meta-llama/llama-3.3-70b-instruct:free`).
- **Reserva:** Together AI (`https://api.together.xyz/v1`, ex.: `meta-llama/Llama-3.3-70B-Instruct-Turbo-Free`) ou DeepSeek (`https://api.deepseek.com/v1`, `deepseek-chat`).
- **Segurança:** chaves mantidas apenas em variáveis privadas da Vercel (nunca com prefixo `VITE_`); dados bancários (`bank`, `agency`, `account_number`) nunca entram no contexto ou nas ferramentas do LLM.
