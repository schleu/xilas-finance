import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/app/ThemeProvider";
import * as banksApi from "@/features/banks/api/banksApi";
import * as categoriesApi from "@/features/categories/api/categoriesApi";
import * as storesApi from "@/features/stores/api/storesApi";
import { SettingsPage } from "./SettingsPage";

vi.mock("@/features/categories/api/categoriesApi", () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  countBillsInCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));
vi.mock("@/features/stores/api/storesApi", () => ({
  listStores: vi.fn(),
  createStore: vi.fn(),
  updateStore: vi.fn(),
  deleteStore: vi.fn(),
}));
vi.mock("@/features/banks/api/banksApi", () => ({
  listBanks: vi.fn(),
  createBank: vi.fn(),
  updateBank: vi.fn(),
  deleteBank: vi.fn(),
}));

describe("SettingsPage (003 & 013 / US-1, US-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");

    vi.mocked(categoriesApi.listCategories).mockResolvedValue([
      { id: "c1", user_id: "u1", name: "Fixa", is_default: true, created_at: "2026-11-26T00:00:00Z" },
    ]);
    vi.mocked(storesApi.listStores).mockResolvedValue([
      {
        id: "s1",
        user_id: "u1",
        name: "Amazon",
        store_type: "online",
        store_subtype: null,
        is_default: true,
        created_at: "2026-11-26T00:00:00Z",
      },
      {
        id: "s2",
        user_id: "u1",
        name: "Assaí",
        store_type: "physical",
        store_subtype: "supermarket",
        is_default: true,
        created_at: "2026-11-26T00:00:00Z",
      },
    ]);
    vi.mocked(banksApi.listBanks).mockResolvedValue([
      {
        id: "b1",
        user_id: "u1",
        name: "Nubank",
        has_debit_account: true,
        agency: "0001",
        account_number: "991234",
        has_credit_card: true,
        credit_card_label: "Ultravioleta",
        credit_card_due_day: 10,
        created_at: "2026-11-26T00:00:00Z",
        updated_at: "2026-11-26T00:00:00Z",
      },
    ]);
  });

  it("alterna entre Categorias, Lojas, Bancos e Aparência pelo submenu lateral, usa tabelas/modais e mascara agência/conta", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MemoryRouter initialEntries={["/configuracoes"]}>
            <SettingsPage />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Fixa")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^lojas$/i }));
    expect(await screen.findByText("Amazon")).toBeInTheDocument();
    expect(screen.getByText("Assaí")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /nova loja/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /cancelar/i }));

    await user.click(screen.getByRole("button", { name: /^bancos$/i }));
    expect(await screen.findByText("Nubank")).toBeInTheDocument();
    expect(screen.getByText(/vence dia 10/i)).toBeInTheDocument();
    expect(screen.getByText(/••••1234/)).toBeInTheDocument();
    expect(screen.queryByText(/991234/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^aparência$/i }));
    const darkBtn = await screen.findByRole("button", { name: "Tema Escuro" });
    await user.click(darkBtn);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
