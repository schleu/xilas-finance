import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  SAFE_CHAT_BILL_COLUMNS,
  runListBillsTool,
  runProposeBillTool,
  runSpendingReportTool,
} from "./tools";

describe("Chat read tools (T-21 & T-22 / US-4)", () => {
  it("list_bills seleciona colunas explícitas sem dados bancários e nunca vaza banco/agência/conta ao LLM", async () => {
    const selectMock = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: "bill-1",
              description: "Energia",
              company: "Enel",
              amount_cents: 25000,
              payment_type: "debit",
              bank: "Banco Secreto",
              agency: "9999",
              account_number: "123456-7",
              due_date: "2026-11-10",
              status: "pending",
              paid_at: null,
              recurring_rule_id: null,
              categories: { name: "Fixa" },
            },
          ],
          error: null,
        }),
      }),
    });

    const supabase = {
      from: vi.fn().mockReturnValue({ select: selectMock }),
    } as unknown as SupabaseClient;

    const result = await runListBillsTool(
      {},
      { supabase, categories: [{ id: "c1", name: "Fixa" }], todayIso: "2026-11-26" },
    );

    expect(selectMock).toHaveBeenCalledWith(SAFE_CHAT_BILL_COLUMNS);
    expect(SAFE_CHAT_BILL_COLUMNS).not.toMatch(/bank|agency|account_number/i);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Banco Secreto");
    expect(serialized).not.toContain("9999");
    expect(serialized).not.toContain("123456-7");
    expect(serialized).not.toContain("agency");
    expect(serialized).not.toContain("account_number");
    expect(result.bills[0]).toMatchObject({
      description: "Energia",
      amount_cents: 25000,
      category_name: "Fixa",
      is_overdue: true,
    });
  });

  it("spending_report usa spending_by_category (somente pagos) e cita pendentes à parte", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: [
        { category_id: "c1", category_name: "Fixa", paid_total_cents: 150000, bills_count: 1 },
        { category_id: "c2", category_name: "Variável", paid_total_cents: 45000, bills_count: 2 },
      ],
      error: null,
    });

    const supabase = {
      rpc: rpcMock,
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                data: [{ amount_cents: 30000 }, { amount_cents: 12000 }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await runSpendingReportTool(
      {},
      { supabase, categories: [], todayIso: "2026-11-26" },
    );

    expect(rpcMock).toHaveBeenCalledWith("spending_by_category", {
      p_from: "2026-11-01",
      p_to: "2026-11-30",
    });
    expect(result.paid_total_cents).toBe(195000);
    expect(result.pending_total_cents).toBe(42000);
    expect(result.by_category).toHaveLength(2);
  });

  it("propose_bill valida com Zod sem gravar no banco e devolve apenas campos faltantes quando incompleto (T-23)", () => {
    const fromMock = vi.fn();
    const supabase = { from: fromMock } as unknown as SupabaseClient;
    const ctx = {
      supabase,
      categories: [{ id: "11111111-1111-4111-8111-111111111111", name: "Fixa" }],
      todayIso: "2026-11-26",
    };

    const incomplete = runProposeBillTool(
      { description: "Internet", amount_cents: 12000 },
      ctx,
    );
    expect(incomplete.proposedBill).toBeUndefined();
    expect(incomplete.toolOutput).toMatchObject({ ok: false });
    expect(fromMock).not.toHaveBeenCalled();

    const valid = runProposeBillTool(
      {
        description: "Internet",
        category_name: "fixa",
        amount_cents: 12000,
        payment_type: "pix",
        due_date: "2026-12-10",
      },
      ctx,
    );
    expect(valid.proposedBill).toMatchObject({
      description: "Internet",
      category_id: "11111111-1111-4111-8111-111111111111",
      category_name: "Fixa",
      amount_cents: 12000,
      payment_type: "pix",
      due_date: "2026-12-10",
      status: "pending",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });
});
