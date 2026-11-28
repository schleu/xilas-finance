import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OPENROUTER_FREE_MODELS,
  createEdgeChatCompletion,
  listEdgePublicModels,
  resolveModelAttemptOrder,
} from "./catalog";

describe("Edge Function chat catalog (008-chat-edge-functions)", () => {
  it("expõe os 7 modelos gratuitos do OpenRouter quando OPENROUTER_API_KEY está configurada", () => {
    const models = listEdgePublicModels({ OPENROUTER_API_KEY: "sk-or-test" });
    expect(models).toHaveLength(7);
    expect(models.map((m) => m.id)).toEqual([
      "openrouter/free",
      "google/gemma-4-31b-it:free",
      "google/gemma-4-26b-a4b-it:free",
      "inclusionai/ling-3.2-flash:free",
      "nvidia/nemotron-3.5-super-vl:free",
      "baidu/ernie-5.5-flash-preview:free",
      "nvidia/nemotron-3.5-lightning:free",
    ]);
    expect(models[0]?.isDefault).toBe(true);
    expect(DEFAULT_OPENROUTER_FREE_MODELS).toHaveLength(7);
  });

  it("permite sobrescrever o catálogo via FINANCE_LLM_MODELS (plugabilidade)", () => {
    const models = listEdgePublicModels({
      FINANCE_LLM_MODELS: JSON.stringify([
        {
          id: "custom-model",
          label: "Custom Model",
          baseUrl: "https://example.com/v1",
          model: "custom/v1",
          apiKey: "secret",
          isDefault: true,
        },
      ]),
    });
    expect(models).toEqual([{ id: "custom-model", label: "Custom Model", isDefault: true }]);
  });

  it("executa fallback automático para o próximo modelo quando recebe 429", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Resposta via fallback" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const result = await createEdgeChatCompletion({
      messages: [{ role: "user", content: "oi" }],
      modelId: "openrouter/free",
      env: { OPENROUTER_API_KEY: "sk-or-test" },
      fetchFn: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.usedFallback).toBe(true);
    expect(result.providerModel).toBe("google/gemma-4-31b-it:free");
    expect(result.content).toBe("Resposta via fallback");
  });

  it("rejeita modelo desconhecido com erro 400", () => {
    expect(() =>
      resolveModelAttemptOrder({ OPENROUTER_API_KEY: "sk-or-test" }, "inexistente"),
    ).toThrow(/não está disponível/i);
  });
});
