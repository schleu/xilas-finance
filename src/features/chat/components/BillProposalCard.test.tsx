import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProposedBillDraft } from "@/features/chat/schemas/chatSchemas";
import { BillProposalCard } from "./BillProposalCard";

const sampleProposal: ProposedBillDraft = {
  description: "Internet fibra",
  company: "Vivo",
  category_id: "11111111-1111-4111-8111-111111111111",
  category_name: "Fixa",
  amount_cents: 12000,
  payment_type: "pix",
  bank: null,
  agency: null,
  account_number: null,
  due_date: "2026-12-10",
  status: "pending",
  paid_at: null,
  recurring: false,
};

describe("BillProposalCard (T-23 / US-4)", () => {
  it("exibe resumo da conta proposta e só confirma ao clicar em Confirmar e salvar", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <BillProposalCard
        proposal={sampleProposal}
        status="pending"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText("Internet fibra")).toBeInTheDocument();
    expect(screen.getByText("Fixa")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*120,00/)).toBeInTheDocument();
    expect(screen.getByText("10/12/2026")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /confirmar e salvar/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
