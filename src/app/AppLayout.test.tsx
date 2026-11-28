import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { getUserInitials } from "@/features/auth/hooks/useUserProfile";
import { AppLayout } from "./AppLayout";

const signOutMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/features/auth/hooks/useAuth", () => ({
  useAuth: () => ({
    session: {
      user: {
        id: "user-1",
        email: "danilo.silva@example.com",
        user_metadata: { display_name: "Danilo Silva" },
      },
    },
    signOut: signOutMock,
  }),
}));

vi.mock("@/features/auth/hooks/useUserProfile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/hooks/useUserProfile")>();
  return {
    ...actual,
    useUserProfile: () => ({ data: "Danilo Silva" }),
  };
});

function renderLayout(initialPath = "/despesas") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<div>Página inicial</div>} />
            <Route path="/despesas" element={<div>Página despesas</div>} />
            <Route path="/rendas" element={<div>Página rendas</div>} />
            <Route path="/chat" element={<div>Página chat</div>} />
            <Route path="/configuracoes" element={<div>Página configurações</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("getUserInitials", () => {
  it("gera iniciais do nome completo, nome simples ou fallback do e-mail", () => {
    expect(getUserInitials("Danilo Silva", "d@x.com")).toBe("DS");
    expect(getUserInitials("Maria Fernanda Costa", "m@x.com")).toBe("MC");
    expect(getUserInitials("Ana", "a@x.com")).toBe("AN");
    expect(getUserInitials(null, "joao.pedro@example.com")).toBe("JP");
    expect(getUserInitials(null, "carlos@example.com")).toBe("CA");
    expect(getUserInitials(null, null)).toBe("US");
  });
});

describe("AppLayout (011-layout-navigation-and-homepage / US-1)", () => {
  it("direciona o título Xilas Finance para a homepage", async () => {
    const user = userEvent.setup();
    renderLayout("/despesas");

    const brandLink = screen.getByRole("link", { name: "Xilas Finance" });
    expect(brandLink).toHaveAttribute("href", "/");

    await user.click(brandLink);
    expect(screen.getByText("Página inicial")).toBeInTheDocument();
  });

  it("exibe iniciais do nome no círculo, oculta e-mail e remove seleção de tema do cabeçalho", () => {
    renderLayout("/");

    expect(screen.getByRole("img", { name: /usuário: danilo silva/i })).toHaveTextContent("DS");
    expect(screen.queryByText("danilo.silva@example.com")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tema claro/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tema escuro/i })).not.toBeInTheDocument();
  });

  it("exibe ícones nos itens do menu principal e oferece menu mobile acessível", async () => {
    const user = userEvent.setup();
    renderLayout("/");

    const desktopNav = screen.getByRole("navigation", { name: /navegação principal/i });
    const links = within(desktopNav).getAllByRole("link");
    expect(links).toHaveLength(5);
    for (const link of links) {
      expect(link.querySelector("svg")).not.toBeNull();
    }

    const menuButton = screen.getByRole("button", { name: /abrir menu/i });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await user.click(menuButton);
    expect(screen.getByRole("button", { name: /fechar menu/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const mobileNav = screen.getByRole("navigation", { name: /menu mobile/i });
    expect(within(mobileNav).getByRole("link", { name: /despesas/i })).toBeInTheDocument();

    await user.click(within(mobileNav).getByRole("link", { name: /despesas/i }));
    expect(screen.getByText("Página despesas")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /menu mobile/i })).not.toBeInTheDocument();
  });
});
