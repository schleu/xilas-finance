# Plano técnico 007 — Supermercado, Subitens e Importação de NF-e / NFC-e (CE e BA)

Deriva de `spec.md` v0.2 e `specs/constitution.md`.

## 1. Arquitetura e decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Modelo de compra | Reutilizar `bills` (categoria `Supermercado` + colunas opcionais `nfe_url` e `supermarket_payment_method` + `store_id` da `003`) + tabela filha `bill_items` | Aproveita homepage, filtros, gráficos, RLS e chatbot sem duplicar lógica |
| Formas de pagamento | Enum `supermarket_payment_method` (`credit`, `debit_card`, `food_voucher`, `meal_voucher`, `pix`, `cash`) em `bills` | Separa cartão de débito/vales de supermercado do `debit` (débito em conta bancária) |
| Leitor de QR Code | Biblioteca leve no cliente (`html5-qrcode` ou `BarcodeDetector` + fallback `jsqr`) em modal dedicado | Funciona em iOS Safari, Android Chrome e desktop |
| Parser de NF-e / NFC-e | Vercel Function `api/nfe/parse.ts` (autenticada por JWT, imports ESM `.js`) com `api/_nfe/sefazCe.ts` e `api/_nfe/sefazBa.ts` usando `cheerio` | Evita CORS do navegador, garante allowlist anti-SSRF e facilita testes unitários com fixtures HTML |
| Classificação de subitens | Mapa determinístico de palavras-chave (`api/_nfe/classifyItem.ts`) | Instantâneo, previsível, gratuito e testável |

## 2. Modelo de dados

```sql
create type public.supermarket_payment_method as enum (
  'credit',
  'debit_card',
  'food_voucher',
  'meal_voucher',
  'pix',
  'cash'
);

create type public.bill_item_category as enum (
  'food',
  'cleaning',
  'hygiene',
  'beverages',
  'produce',
  'bakery_butcher',
  'other'
);

create type public.bill_item_unit as enum (
  'un',
  'kg',
  'g',
  'l',
  'ml',
  'pct'
);

alter table public.bills
  add column supermarket_payment_method public.supermarket_payment_method,
  add column nfe_url text;

create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  description text not null check (char_length(btrim(description)) between 1 and 160),
  item_category public.bill_item_category not null default 'other',
  quantity numeric(10, 3) not null check (quantity > 0),
  unit public.bill_item_unit not null default 'un',
  unit_price_cents integer not null check (unit_price_cents > 0),
  total_cents integer not null check (total_cents > 0),
  created_at timestamptz not null default now()
);

create index bill_items_bill_id_idx on public.bill_items (bill_id);
create index bill_items_user_id_idx on public.bill_items (user_id);
```

- Atualizar `handle_new_user()` para incluir `'Supermercado'` nas categorias padrão + backfill idempotente.

## 3. Segurança (RLS)

- `alter table public.bill_items enable row level security;`
- Políticas `select`, `insert`, `update`, `delete` restritas a `authenticated` com `user_id = (select auth.uid())` e verificação de posse de `bill_id`.
- Teste pgTAP em `supabase/tests/08_supermarket_bill_items_rls.sql`.
- `api/nfe/parse.ts`: valida JWT, valida allowlist de domínios SEFAZ-CE / SEFAZ-BA (anti-SSRF), timeout 10s, retorna `422` (`CAPTCHA_REQUIRED` / `UNSUPPORTED_FORMAT`) sem tentar contornar CAPTCHA.

## 4. Contratos (API, funções, ferramentas)

- `POST /api/nfe/parse` (autenticado): entrada `{ url: string }`; saída `{ uf, marketName, issuedDate, totalCents, items }`.
- Schema Zod compartilhado `billItemSchema` em `src/features/bills/schemas/billItemSchema.ts`.

## 5. Riscos e mitigações

- **Mudança no HTML da SEFAZ-CE / SEFAZ-BA ou CAPTCHA:** parsers isolados por UF com fixtures HTML e fallback gracioso para preenchimento manual mantendo o link salvo.
- **Permissão de câmera mobile:** encerrar todas as `MediaStreamTrack` ao fechar/desmontar o modal.

## 6. Mapeamento spec → plano

| Spec | Onde é atendida |
|---|---|
| US-1 | Migração (`Supermercado`, `supermarket_payment_method`, `nfe_url`) + campos condicionais + seletor de supermercados (`stores`) no `BillForm` |
| US-2 | Tabela `bill_items` + RLS + `billItemSchema` + editor/visualizador de subitens |
| US-3 | `QrCodeScannerModal` em `src/features/bills/components/` |
| US-4 | `api/nfe/parse.ts`, `api/_nfe/{sefazCe,sefazBa,classifyItem}.ts` e integração no `BillForm` |
