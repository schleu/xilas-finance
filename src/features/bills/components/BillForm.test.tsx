import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Bill } from "@/features/bills/api/billsApi";
import type { Category } from "@/features/categories/api/categoriesApi";
import { BillForm } from "./BillForm";

const categories: Category[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "u1",
    name: "Fixa",
    is_default: true,
    created_at: "2026-11-26T00:00:00Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: "u1",
    name: "Variável",
    is_default: true,
    created_at: "2026-11-26T00:00:00Z",
  },
];

describe("BillForm (T-10 / US-2)", () => {
  it("não salva sem campos obrigatórios e exibe erros por campo", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<BillForm categories={categories} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /salvar despesa/i }));

    expect(await screen.findByText(/informe a descrição/i)).toBeInTheDocument();
    expect(screen.getByText(/informe um valor válido/i)).toBeInTheDocument();
    expect(screen.getByText(/informe uma data válida/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("exibe e exige banco, agência e conta apenas quando tipo = débito em conta", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<BillForm categories={categories} onSubmit={onSubmit} />);

    expect(screen.queryByLabelText(/^banco/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^agência/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^conta/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/tipo de pagamento/i), "debit");

    expect(screen.getByLabelText(/^banco/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^agência/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^conta/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/descrição/i), "Energia");
    await user.type(screen.getByLabelText(/valor/i), "250,00");
    await user.type(screen.getByLabelText(/vencimento/i), "2026-12-15");
    await user.click(screen.getByRole("button", { name: /salvar despesa/i }));

    expect(await screen.findByText(/informe o banco/i)).toBeInTheDocument();
    expect(screen.getByText(/informe a agência/i)).toBeInTheDocument();
    expect(screen.getByText(/informe a conta/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    // Trocar de volta para Pix oculta e limpa os campos bancários
    await user.type(screen.getByLabelText(/^banco/i), "Banco X");
    await user.selectOptions(screen.getByLabelText(/tipo de pagamento/i), "pix");
    expect(screen.queryByLabelText(/^banco/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /salvar despesa/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Energia",
          amount_cents: 25000,
          payment_type: "pix",
          bank: null,
          agency: null,
          account_number: null,
        }),
      );
    });
  });

  it("converte valor em BRL para centavos inteiros e envia conta paga com data de pagamento", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<BillForm categories={categories} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/descrição/i), "Aluguel");
    await user.type(screen.getByLabelText(/empresa/i), "Imobiliária");
    await user.selectOptions(screen.getByLabelText(/categoria/i), categories[0]!.id);
    await user.type(screen.getByLabelText(/valor/i), "1.250,50");
    await user.type(screen.getByLabelText(/vencimento/i), "2026-12-10");
    await user.selectOptions(screen.getByLabelText(/status/i), "paid");

    const paidAtInput = screen.getByLabelText(/data de pagamento/i) as HTMLInputElement;
    expect(paidAtInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await user.click(screen.getByRole("button", { name: /salvar despesa/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        description: "Aluguel",
        company: "Imobiliária",
        category_id: categories[0]!.id,
        amount_cents: 125050,
        payment_type: "pix",
        bank: null,
        agency: null,
        account_number: null,
        due_date: "2026-12-10",
        status: "paid",
        paid_at: paidAtInput.value,
      });
    });
  });

  it("preenche dados bancários completos na edição de conta em débito", () => {
    const existingBill: Bill = {
      id: "bill-1",
      user_id: "u1",
      description: "Energia",
      company: "Enel",
      category_id: categories[0]!.id,
      amount_cents: 19990,
      payment_type: "debit",
      bank: "Banco do Brasil",
      agency: "1234",
      account_number: "56789-0",
      due_date: "2026-12-15",
      status: "pending",
      paid_at: null,
      created_at: "2026-11-26T00:00:00Z",
      updated_at: "2026-11-26T00:00:00Z",
    };

    render(<BillForm categories={categories} initialBill={existingBill} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/descrição/i)).toHaveValue("Energia");
    expect(screen.getByLabelText(/valor/i)).toHaveValue("199,90");
    expect(screen.getByLabelText(/^banco/i)).toHaveValue("Banco do Brasil");
    expect(screen.getByLabelText(/^agência/i)).toHaveValue("1234");
    expect(screen.getByLabelText(/^conta/i)).toHaveValue("56789-0");
  });

  it("permite marcar nova conta como recorrente (T-17 / US-2b)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<BillForm categories={categories} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/descrição/i), "Aluguel");
    await user.type(screen.getByLabelText(/valor/i), "1500,00");
    await user.type(screen.getByLabelText(/vencimento/i), "2026-12-05");
    await user.click(screen.getByLabelText(/^recorrente/i));
    await user.click(screen.getByRole("button", { name: /salvar despesa/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Aluguel", amount_cents: 150000 }),
        { recurring: true },
      );
    });
  });

  it("permite escolher escopo 'só este' ou 'este e os futuros pendentes' ao editar conta recorrente (T-17)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    const recurringBill: Bill = {
      id: "bill-rec-1",
      user_id: "u1",
      description: "Academia",
      company: null,
      category_id: categories[0]!.id,
      amount_cents: 12000,
      payment_type: "credit",
      bank: null,
      agency: null,
      account_number: null,
      due_date: "2026-12-10",
      status: "pending",
      paid_at: null,
      recurring_rule_id: "rule-1",
      created_at: "2026-11-26T00:00:00Z",
      updated_at: "2026-11-26T00:00:00Z",
    };

    render(<BillForm categories={categories} initialBill={recurringBill} onSubmit={onSubmit} />);

    expect(screen.getByLabelText(/só este lançamento/i)).toBeChecked();
    await user.click(screen.getByLabelText(/este e os futuros pendentes/i));
    await user.click(screen.getByRole("button", { name: /salvar despesa/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Academia" }),
        { editScope: "future" },
      );
    });
  });
});
