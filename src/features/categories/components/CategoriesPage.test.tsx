import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as categoriesApi from "@/features/categories/api/categoriesApi";
import type { Category } from "@/features/categories/api/categoriesApi";
import { CategoriesPage } from "./CategoriesPage";

vi.mock("@/features/categories/api/categoriesApi", () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  countBillsInCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

const mockedApi = vi.mocked(categoriesApi);

const defaultCategories: Category[] = [
  { id: "cat-1", user_id: "u1", name: "Fixa", is_default: true, created_at: "2026-11-26T00:00:00Z" },
  {
    id: "cat-2",
    user_id: "u1",
    name: "Variável",
    is_default: true,
    created_at: "2026-11-26T00:00:00Z",
  },
  {
    id: "cat-3",
    user_id: "u1",
    name: "Cartão de Crédito",
    is_default: true,
    created_at: "2026-11-26T00:00:00Z",
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CategoriesPage />
    </QueryClientProvider>,
  );
}

describe("CategoriesPage (T-07 & 013 / US-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.listCategories.mockResolvedValue([...defaultCategories]);
    mockedApi.countBillsInCategory.mockResolvedValue(0);
    mockedApi.createCategory.mockImplementation(async (name) => ({
      id: "cat-4",
      user_id: "u1",
      name,
      is_default: false,
      created_at: "2026-11-26T00:00:00Z",
    }));
    mockedApi.renameCategory.mockImplementation(async (id, name) => ({
      id,
      user_id: "u1",
      name,
      is_default: false,
      created_at: "2026-11-26T00:00:00Z",
    }));
    mockedApi.deleteCategory.mockResolvedValue(undefined);
  });

  it("lista as categorias padrão em tabela e permite criar nova categoria via modal", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Fixa")).toBeInTheDocument();
    expect(screen.getByText("Variável")).toBeInTheDocument();
    expect(screen.getByText("Cartão de Crédito")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /nova categoria/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/nome da categoria/i), "Lazer");
    await user.click(within(dialog).getByRole("button", { name: /^adicionar$/i }));

    await waitFor(() => {
      expect(mockedApi.createCategory).toHaveBeenCalledWith("Lazer");
    });
  });

  it("bloqueia criação de categoria duplicada sem diferenciar maiúsculas", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Fixa");

    await user.click(screen.getByRole("button", { name: /nova categoria/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/nome da categoria/i), "  fixa  ");
    await user.click(within(dialog).getByRole("button", { name: /^adicionar$/i }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /já existe uma categoria com este nome/i,
    );
    expect(mockedApi.createCategory).not.toHaveBeenCalled();
  });

  it("permite editar uma categoria via modal e bloqueia renomear para nome já existente", async () => {
    const user = userEvent.setup();
    renderPage();

    const fixaRow = (await screen.findByText("Fixa")).closest("tr")!;
    await user.click(within(fixaRow).getByRole("button", { name: /^editar$/i }));

    const dialog = await screen.findByRole("dialog");
    const renameInput = within(dialog).getByLabelText(/nome da categoria/i);
    await user.clear(renameInput);
    await user.type(renameInput, "VARIÁVEL");
    await user.click(within(dialog).getByRole("button", { name: /^salvar$/i }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /já existe uma categoria com este nome/i,
    );
    expect(mockedApi.renameCategory).not.toHaveBeenCalled();

    await user.clear(renameInput);
    await user.type(renameInput, "Moradia");
    await user.click(within(dialog).getByRole("button", { name: /^salvar$/i }));

    await waitFor(() => {
      expect(mockedApi.renameCategory).toHaveBeenCalledWith("cat-1", "Moradia");
    });
  });

  it("exclui categoria sem contas após confirmação em modal", async () => {
    const user = userEvent.setup();
    mockedApi.countBillsInCategory.mockResolvedValue(0);
    renderPage();

    const fixaRow = (await screen.findByText("Fixa")).closest("tr")!;
    await user.click(within(fixaRow).getByRole("button", { name: /^excluir$/i }));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /confirmar exclusão/i }));

    await waitFor(() => {
      expect(mockedApi.deleteCategory).toHaveBeenCalledWith("cat-1", undefined);
    });
  });

  it("exige reatribuição antes de excluir categoria em uso", async () => {
    const user = userEvent.setup();
    mockedApi.countBillsInCategory.mockResolvedValue(3);
    renderPage();

    const fixaRow = (await screen.findByText("Fixa")).closest("tr")!;
    await user.click(within(fixaRow).getByRole("button", { name: /^excluir$/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/3 conta\(s\) vinculada\(s\)/i)).toBeInTheDocument();

    const reassignBtn = within(dialog).getByRole("button", { name: /reatribuir e excluir/i });
    expect(reassignBtn).toBeDisabled();

    const select = within(dialog).getByLabelText(/reatribuir contas para/i);
    await user.selectOptions(select, "cat-2");

    expect(reassignBtn).toBeEnabled();
    await user.click(reassignBtn);

    await waitFor(() => {
      expect(mockedApi.deleteCategory).toHaveBeenCalledWith("cat-1", "cat-2");
    });
  });
});
