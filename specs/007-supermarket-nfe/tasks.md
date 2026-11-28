# Tarefas 007 — Supermercado, Subitens e Importação de NF-e / NFC-e (CE e BA)

Cada tarefa cabe em um PR pequeno. `[P]` = pode rodar em paralelo. `Dep:` = depende de.

## Fase 1 — Banco de dados e RLS (US-1, US-2)

- [ ] **T-01 Migração: categoria Supermercado, campos em `bills` e tabela `bill_items` com RLS.** Criar enums (`supermarket_payment_method`, `bill_item_category`, `bill_item_unit`), adicionar colunas opcionais em `bills`, criar `bill_items` com RLS e atualizar trigger/backfill para incluir a categoria padrão `Supermercado`. *Pronto:* teste pgTAP de RLS e constraints (valores > 0 em centavos).

## Fase 2 — Schema e UI de Supermercado + Subitens (US-1, US-2)

- [ ] **T-02 Schemas Zod e serviço de despesas de supermercado e subitens.** Criar `billItemSchema`, estender `billSchema` com campos condicionais de supermercado e implementar CRUD de `bill_items` via TanStack Query. *Dep:* T-01. *Pronto:* testes unitários de validação (centavos inteiros, unidades, cálculo de total).
- [ ] **T-03 Formulário de Supermercado e editor de subitens.** Integrar seleção de supermercados cadastrados em Configurações, formas de pagamento de supermercado, campo de link NF-e e editor de subitens (soma vs total da despesa) no `BillForm` e visualização na lista/detalhe. *Dep:* T-02. *Pronto:* testes de componente cobrindo US-1 e US-2.

## Fase 3 — Leitura de QR Code (US-3)

- [ ] **T-04 [P] Modal leitor de QR Code via câmera.** Implementar `QrCodeScannerModal` que lê URL de NFC-e pela câmera, encerra as tracks ao fechar e trata ausência/negação de permissão com fallback para colar link. *Dep:* T-03. *Pronto:* testes de componente cobrindo leitura, erro de permissão e cleanup de câmera.

## Fase 4 — Parser de NF-e / NFC-e para CE e BA (US-4)

- [ ] **T-05 Parsers HTML da SEFAZ-CE e SEFAZ-BA + classificador de subitens.** Implementar `api/_nfe/sefazCe.ts`, `api/_nfe/sefazBa.ts` e `api/_nfe/classifyItem.ts` com validação de allowlist anti-SSRF e detecção de CAPTCHA. *Pronto:* testes unitários com fixtures HTML de CE e BA, valores em centavos e bloqueio de URLs fora da allowlist.
- [ ] **T-06 Endpoint `POST /api/nfe/parse` e integração no `BillForm`.** Criar Vercel Function autenticada por JWT usando os parsers da T-05 (com imports `.js` para ESM), integrar botão "Importar da NF-e" no formulário para pré-preencher mercado (vinculando loja cadastrada quando houver match), total e subitens para revisão antes de salvar. *Dep:* T-04, T-05. *Pronto:* testes da API, regressão ESM e `npm run check` verde.
