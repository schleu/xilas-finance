import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchChatModels, sendChatMessage } from "./chatApi";

describe("chatApi via Supabase Edge Function (008-chat-edge-functions)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv("VITE_FINANCE_SUPABASE_URL", "https://proj.supabase.co");
    vi.stubEnv("VITE_FINANCE_SUPABASE_ANON_KEY", "anon-key-123");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("consulta modelos via GET /functions/v1/chat com JWT e apikey", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [{ id: "openrouter/free", label: "OpenRouter Free (Auto)", isDefault: true }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock;

    const models = await fetchChatModels("user-jwt");
    expect(models).toHaveLength(1);
    expect(models[0]?.id).toBe("openrouter/free");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://proj.supabase.co/functions/v1/chat",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer user-jwt",
          apikey: "anon-key-123",
        }),
      }),
    );
  });

  it("envia mensagens via POST /functions/v1/chat com modelId opcional", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          reply: "Olá!",
          usedFallback: false,
          modelId: "google/gemma-4-31b-it:free",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock;

    const res = await sendChatMessage(
      [{ role: "user", content: "oi" }],
      "user-jwt",
      "google/gemma-4-31b-it:free",
    );
    expect(res.reply).toBe("Olá!");
    expect(res.modelId).toBe("google/gemma-4-31b-it:free");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://proj.supabase.co/functions/v1/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer user-jwt",
          apikey: "anon-key-123",
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});
