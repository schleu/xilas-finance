import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { FRIENDLY_LLM_UNAVAILABLE_MESSAGE, LlmProviderError } from "./_llm/provider";
import { SlidingWindowRateLimiter } from "./_llm/rateLimit";
import { createChatHandler, type ChatHttpResponse } from "./chat";

function createMockRes() {
  let statusCode = 200;
  let body: unknown = null;
  const res: ChatHttpResponse = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
    },
  };
  return {
    res,
    getStatus: () => statusCode,
    getBody: () => body,
  };
}

function createFakeSupabase(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        userId
          ? { data: { user: { id: userId } }, error: null }
          : { data: { user: null }, error: new Error("invalid jwt") },
      ),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [{ id: "cat-1", name: "Fixa" }],
          error: null,
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("/api/chat (T-20 / US-4)", () => {
  it("rejeita métodos diferentes de POST com 405", async () => {
    const handler = createChatHandler();
    const mock = createMockRes();
    await handler({ method: "GET", headers: {} }, mock.res);
    expect(mock.getStatus()).toBe(405);
  });

  it("rejeita requisições sem JWT ou com JWT inválido com 401", async () => {
    const handler = createChatHandler({
      createUserSupabase: () => createFakeSupabase(null),
    });

    const missing = createMockRes();
    await handler(
      { method: "POST", headers: {}, body: { messages: [{ role: "user", content: "oi" }] } },
      missing.res,
    );
    expect(missing.getStatus()).toBe(401);

    const invalid = createMockRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer bad-token" },
        body: { messages: [{ role: "user", content: "oi" }] },
      },
      invalid.res,
    );
    expect(invalid.getStatus()).toBe(401);
  });

  it("aplica limite de mensagens por usuário (429)", async () => {
    const rateLimiter = new SlidingWindowRateLimiter(2, 60_000);
    const complete = vi.fn().mockResolvedValue({
      content: "Olá!",
      toolCalls: [],
      providerModel: "test",
      usedFallback: false,
    });
    const handler = createChatHandler({
      createUserSupabase: () => createFakeSupabase("user-1"),
      complete,
      rateLimiter,
    });

    const req = {
      method: "POST",
      headers: { authorization: "Bearer valid-jwt" },
      body: { messages: [{ role: "user", content: "oi" }] },
    };

    const r1 = createMockRes();
    await handler(req, r1.res);
    expect(r1.getStatus()).toBe(200);

    const r2 = createMockRes();
    await handler(req, r2.res);
    expect(r2.getStatus()).toBe(200);

    const r3 = createMockRes();
    await handler(req, r3.res);
    expect(r3.getStatus()).toBe(429);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("devolve mensagem amigável 503 quando provedor de LLM falha", async () => {
    const handler = createChatHandler({
      createUserSupabase: () => createFakeSupabase("user-2"),
      rateLimiter: new SlidingWindowRateLimiter(10, 60_000),
      complete: vi.fn().mockRejectedValue(new LlmProviderError(FRIENDLY_LLM_UNAVAILABLE_MESSAGE)),
    });

    const mock = createMockRes();
    await handler(
      {
        method: "POST",
        headers: { authorization: "Bearer valid-jwt" },
        body: { messages: [{ role: "user", content: "oi" }] },
      },
      mock.res,
    );

    expect(mock.getStatus()).toBe(503);
    expect(mock.getBody()).toEqual({ error: FRIENDLY_LLM_UNAVAILABLE_MESSAGE });
  });

  it("usa extensão .js explícita em imports relativos de runtime em api/ (compatibilidade ESM na Vercel)", () => {
    const apiDir = resolve(process.cwd(), "api");
    const runtimeFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
          runtimeFiles.push(full);
        }
      }
    };
    walk(apiDir);

    const relativeImportRegex = /\bfrom\s+["'](\.[^"']+)["']/g;
    for (const file of runtimeFiles) {
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(relativeImportRegex)) {
        const specifier = match[1]!;
        expect(
          specifier.endsWith(".js"),
          `Import relativo "${specifier}" em ${file} deve terminar com .js para Node ESM na Vercel`,
        ).toBe(true);
      }
    }
  });
});
