import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SAFE_CHAT_BILL_COLUMNS } from "./_llm/tools";

const ROOT = resolve(process.cwd());

function walkFiles(dir: string, extFilter: RegExp): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...walkFiles(full, extFilter));
    } else if (extFilter.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

describe("Revisão de segurança (T-26)", () => {
  it("todas as tabelas criadas em supabase/migrations têm RLS habilitada", () => {
    const migrationsDir = join(ROOT, "supabase", "migrations");
    const sqlFiles = walkFiles(migrationsDir, /\.sql$/);
    const fullSql = sqlFiles.map((f) => readFileSync(f, "utf8")).join("\n");

    const createdTables = [...fullSql.matchAll(/create\s+table\s+public\.([a-z0-9_]+)/gi)].map(
      (m) => m[1]!,
    );

    expect(createdTables.length).toBeGreaterThanOrEqual(4);
    for (const table of createdTables) {
      const rlsRegex = new RegExp(
        `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
        "i",
      );
      expect(fullSql, `Tabela public.${table} deve ter RLS habilitada`).toMatch(rlsRegex);
    }
  });

  it("nenhum segredo (service_role ou chave de LLM) é referenciado no bundle do cliente (src/)", () => {
    const srcFiles = walkFiles(join(ROOT, "src"), /\.(ts|tsx)$/).filter(
      (f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"),
    );

    for (const file of srcFiles) {
      const content = readFileSync(file, "utf8");
      expect(content, `${file} não deve referenciar service_role`).not.toMatch(/service_role/i);
      expect(content, `${file} não deve referenciar chaves de LLM`).not.toMatch(
        /(FINANCE_)?LLM_(PRIMARY|FALLBACK)_API_KEY|VITE_(FINANCE_)?LLM_|VITE_(FINANCE_)?SERVICE_ROLE/i,
      );
    }
  });

  it(".env.example não expõe segredos com prefixo VITE_", () => {
    const envExample = readFileSync(join(ROOT, ".env.example"), "utf8");
    const viteLines = envExample
      .split(/\r?\n/)
      .filter((line) => line.trim().startsWith("VITE_"));
    for (const line of viteLines) {
      expect(line).not.toMatch(/KEY_SECRET|SERVICE_ROLE|LLM_|API_KEY/i);
    }
  });

  it("colunas do chatbot não incluem dados bancários sensíveis e nenhum console.log vaza agência/conta", () => {
    expect(SAFE_CHAT_BILL_COLUMNS).not.toMatch(/\b(bank|agency|account_number)\b/i);

    const codeFiles = [
      ...walkFiles(join(ROOT, "src"), /\.(ts|tsx)$/),
      ...walkFiles(join(ROOT, "api"), /\.ts$/),
    ].filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));

    for (const file of codeFiles) {
      const content = readFileSync(file, "utf8");
      expect(content, `${file} não deve registrar dados bancários em console`).not.toMatch(
        /console\.(log|info|warn|error)\([^)]*(agency|account_number|bank)/i,
      );
    }
  });
});
