import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  NfeParseError,
  parseSefazHtml,
  validateAndDetectSefazUrl,
} from "../_nfe/parser.js";

export interface NfeHttpRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface NfeHttpResponse {
  status(code: number): NfeHttpResponse;
  json(payload: unknown): void;
}

const bodySchema = z.object({
  url: z.string().trim().url("Informe uma URL válida."),
});

function extractBearerToken(headers: Record<string, string | string[] | undefined>): string | null {
  const raw = headers.authorization ?? headers.Authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

function defaultCreateUserSupabase(jwt: string): SupabaseClient {
  const url = process.env.FINANCE_SUPABASE_URL ?? process.env.VITE_FINANCE_SUPABASE_URL;
  const anonKey =
    process.env.FINANCE_SUPABASE_ANON_KEY ?? process.env.VITE_FINANCE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Configuração Supabase ausente no servidor.");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

export function createNfeParseHandler(deps?: {
  createUserSupabase?: (jwt: string) => SupabaseClient;
  fetchFn?: typeof fetch;
}) {
  const createUserSupabase = deps?.createUserSupabase ?? defaultCreateUserSupabase;
  const fetchFn = deps?.fetchFn ?? fetch;

  return async function handler(req: NfeHttpRequest, res: NfeHttpResponse): Promise<void> {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Método não permitido. Use POST." });
      return;
    }

    const jwt = extractBearerToken(req.headers);
    if (!jwt) {
      res.status(401).json({ error: "Sessão ausente." });
      return;
    }

    let supabase: SupabaseClient;
    try {
      supabase = createUserSupabase(jwt);
    } catch {
      res.status(500).json({ error: "Configuração do servidor incompleta." });
      return;
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !userData.user) {
      res.status(401).json({ error: "Sessão inválida." });
      return;
    }

    const parsedBody = bodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: "Informe uma URL válida da NF-e/NFC-e." });
      return;
    }

    try {
      const { url, uf } = validateAndDetectSefazUrl(parsedBody.data.url);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetchFn(url.toString(), {
          method: "GET",
          headers: { "User-Agent": "XilasFinance/1.0" },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new NfeParseError(
            "FETCH_FAILED",
            "Não foi possível consultar a página da SEFAZ no momento.",
            502,
          );
        }
        const html = (await response.text()).slice(0, 500_000);
        const result = parseSefazHtml(html, uf);
        res.status(200).json(result);
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      if (err instanceof NfeParseError) {
        res.status(err.statusCode).json({ error: err.message, code: err.code });
        return;
      }
      res.status(502).json({
        error: "Não foi possível consultar a SEFAZ. Você pode cadastrar os itens manualmente.",
        code: "FETCH_FAILED",
      });
    }
  };
}

export default createNfeParseHandler();
