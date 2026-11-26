import { describe, expect, it, vi } from "vitest";
import {
  FRIENDLY_LLM_UNAVAILABLE_MESSAGE,
  LlmProviderError,
  createChatCompletion,
} from "./provider";

const baseEnv = {
  LLM_PRIMARY_BASE_URL: "https://primary.example/v1",
  LLM_PRIMARY_MODEL: "primary-model",
  LLM_PRIMARY_API_KEY: "sk-primary-secret",
  LLM_FALLBACK_BASE_URL: "https://fallback.example/v1",
  LLM_FALLBACK_MODEL: "fallback-model",
  LLM_FALLBACK_API_KEY: "sk-fallback-secret",
};

function makeOkResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LLM provider layer (T-19 / US-4)", () => {
  it("chama o provedor primário com contrato OpenAI-compatível e retorna texto e tool_calls", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      makeOkResponse({
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: { name: "list_bills", arguments: '{"status":"pending"}' },
                },
              ],
            },
          },
        ],
      }),
    );

    const result = await createChatCompletion({
      messages: [{ role: "user", content: "quais contas vencem hoje?" }],
      env: baseEnv,
      fetchFn: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://primary.example/v1/chat/completions");
    expect(result.usedFallback).toBe(false);
    expect(result.providerModel).toBe("primary-model");
    expect(result.toolCalls).toEqual([
      { id: "call-1", name: "list_bills", arguments: '{"status":"pending"}' },
    ]);
  });

  it("faz fallback automático para o provedor reserva em erro 429", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(
        makeOkResponse({
          choices: [{ message: { content: "Resposta do provedor reserva" } }],
        }),
      );

    const result = await createChatCompletion({
      messages: [{ role: "user", content: "oi" }],
      env: baseEnv,
      fetchFn: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://fallback.example/v1/chat/completions");
    expect(result.usedFallback).toBe(true);
    expect(result.providerModel).toBe("fallback-model");
    expect(result.content).toBe("Resposta do provedor reserva");
  });

  it("faz fallback automático em erro 5xx e em timeout", async () => {
    const fetch500 = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("internal error", { status: 503 }))
      .mockResolvedValueOnce(
        makeOkResponse({ choices: [{ message: { content: "OK pós 503" } }] }),
      );

    const res500 = await createChatCompletion({
      messages: [{ role: "user", content: "oi" }],
      env: baseEnv,
      fetchFn: fetch500,
    });
    expect(res500.usedFallback).toBe(true);
    expect(res500.content).toBe("OK pós 503");

    const fetchTimeout = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          }),
      )
      .mockResolvedValueOnce(
        makeOkResponse({ choices: [{ message: { content: "OK pós timeout" } }] }),
      );

    const resTimeout = await createChatCompletion({
      messages: [{ role: "user", content: "oi" }],
      env: baseEnv,
      fetchFn: fetchTimeout,
      timeoutMs: 20,
    });
    expect(resTimeout.usedFallback).toBe(true);
    expect(resTimeout.content).toBe("OK pós timeout");
  });

  it("retorna erro amigável quando não há reserva ou ambos os provedores falham", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("429", { status: 429 }));

    await expect(
      createChatCompletion({
        messages: [{ role: "user", content: "oi" }],
        env: {
          LLM_PRIMARY_BASE_URL: baseEnv.LLM_PRIMARY_BASE_URL,
          LLM_PRIMARY_MODEL: baseEnv.LLM_PRIMARY_MODEL,
          LLM_PRIMARY_API_KEY: baseEnv.LLM_PRIMARY_API_KEY,
        },
        fetchFn: fetchMock,
      }),
    ).rejects.toThrow(new LlmProviderError(FRIENDLY_LLM_UNAVAILABLE_MESSAGE, 503));
  });

  it("interpreta fallback JSON em texto quando modelo gratuito não envia tool_calls nativo", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      makeOkResponse({
        choices: [
          {
            message: {
              content: '```json\n{"tool":"spending_report","arguments":{"from":"2026-11-01","to":"2026-11-30"}}\n```',
            },
          },
        ],
      }),
    );

    const result = await createChatCompletion({
      messages: [{ role: "user", content: "relatório do mês" }],
      tools: [
        {
          type: "function",
          function: { name: "spending_report", description: "Relatório", parameters: {} },
        },
      ],
      env: baseEnv,
      fetchFn: fetchMock,
    });

    expect(result.toolCalls).toEqual([
      {
        id: "json-fallback-call",
        name: "spending_report",
        arguments: '{"from":"2026-11-01","to":"2026-11-30"}',
      },
    ]);
  });
});
