import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/app/App";
import * as authApi from "@/features/auth/api/authApi";
import { AuthProvider } from "@/features/auth/components/AuthProvider";

vi.mock("@/features/auth/api/authApi", () => {
  return {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updatePassword: vi.fn(),
    signOut: vi.fn(),
    hasPasswordSetupParams: vi.fn((loc: { hash: string; search: string }) => {
      const hashParams = new URLSearchParams(loc.hash.replace(/^#/, ""));
      const searchParams = new URLSearchParams(loc.search);
      const type = hashParams.get("type") ?? searchParams.get("type");
      return type === "invite" || type === "recovery";
    }),
  };
});

const mockedAuthApi = vi.mocked(authApi);

function makeSession(email = "convidado@example.com"): Session {
  return {
    access_token: "token-123",
    refresh_token: "refresh-123",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "11111111-1111-1111-1111-111111111111",
      email,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-11-26T00:00:00Z",
    },
  };
}

let authListener: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;

function renderApp(initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("Auth flow (T-06 / US-0)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authListener = null;
    window.history.replaceState(null, "", "/");
    window.location.hash = "";

    mockedAuthApi.getSession.mockResolvedValue(null);
    mockedAuthApi.onAuthStateChange.mockImplementation((callback) => {
      authListener = callback;
      return () => {
        authListener = null;
      };
    });
    mockedAuthApi.signInWithPassword.mockResolvedValue(undefined);
    mockedAuthApi.resetPasswordForEmail.mockResolvedValue(undefined);
    mockedAuthApi.updatePassword.mockResolvedValue(undefined);
    mockedAuthApi.signOut.mockImplementation(async () => {
      authListener?.("SIGNED_OUT", null);
    });
  });

  afterEach(() => {
    window.location.hash = "";
    window.history.replaceState(null, "", "/");
  });

  it.each(["/", "/contas", "/categorias", "/chat"])(
    "redireciona usuário sem sessão da rota %s para /login e não oferece cadastro público",
    async (route) => {
      renderApp([route]);

      expect(await screen.findByRole("heading", { name: /entrar no xilas finance/i })).toBeInTheDocument();
      expect(screen.getByText(/acesso restrito a pessoas convidadas por e-mail/i)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /cadastr|criar conta|registrar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /cadastr|criar conta|registrar/i })).not.toBeInTheDocument();
    },
  );

  it("valida campos do login em pt-BR e exibe alerta quando autenticação falha", async () => {
    const user = userEvent.setup();
    renderApp(["/login"]);

    await screen.findByRole("heading", { name: /entrar no xilas finance/i });

    await user.click(screen.getByRole("button", { name: /^entrar$/i }));
    expect(await screen.findByText(/informe um e-mail válido/i)).toBeInTheDocument();
    expect(screen.getByText(/informe sua senha/i)).toBeInTheDocument();
    expect(mockedAuthApi.signInWithPassword).not.toHaveBeenCalled();

    mockedAuthApi.signInWithPassword.mockRejectedValueOnce(new Error("E-mail ou senha inválidos."));

    await user.type(screen.getByLabelText(/e-mail/i), "alice@example.com");
    await user.type(screen.getByLabelText(/^senha$/i), "senha-errada");
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    expect(mockedAuthApi.signInWithPassword).toHaveBeenCalledWith("alice@example.com", "senha-errada");
    expect(await screen.findByRole("alert")).toHaveTextContent(/e-mail ou senha inválidos/i);
  });

  it("permite acesso às rotas protegidas autenticado e redireciona /login para /", async () => {
    mockedAuthApi.getSession.mockResolvedValue(makeSession("alice@example.com"));

    renderApp(["/login"]);

    expect(await screen.findByRole("heading", { name: /^início$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^início$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^contas$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^categorias$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^chat$/i })).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sair$/i })).toBeInTheDocument();
  });

  it("faz logout ao clicar em Sair e redireciona para /login", async () => {
    const user = userEvent.setup();
    mockedAuthApi.getSession.mockResolvedValue(makeSession("alice@example.com"));

    renderApp(["/"]);

    const logoutButton = await screen.findByRole("button", { name: /^sair$/i });
    await user.click(logoutButton);

    await waitFor(() => {
      expect(mockedAuthApi.signOut).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByRole("heading", { name: /entrar no xilas finance/i })).toBeInTheDocument();
  });

  it("direciona usuário convidado (#type=invite) para /definir-senha e conclui para /", async () => {
    const user = userEvent.setup();
    window.location.hash = "#access_token=tok&type=invite";
    mockedAuthApi.getSession.mockResolvedValue(makeSession("convidado@example.com"));

    renderApp(["/"]);

    expect(await screen.findByRole("heading", { name: /definir senha/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^nova senha$/i), "minha-senha-123");
    await user.type(screen.getByLabelText(/confirmar nova senha/i), "minha-senha-123");
    await user.click(screen.getByRole("button", { name: /salvar senha/i }));

    await waitFor(() => {
      expect(mockedAuthApi.updatePassword).toHaveBeenCalledWith("minha-senha-123");
    });
    expect(await screen.findByRole("heading", { name: /^início$/i })).toBeInTheDocument();
  });

  it("direciona usuário para /definir-senha quando recebe evento PASSWORD_RECOVERY", async () => {
    const session = makeSession("recuperacao@example.com");
    mockedAuthApi.getSession.mockResolvedValue(session);

    renderApp(["/"]);
    await screen.findByRole("heading", { name: /^início$/i });

    act(() => {
      authListener?.("PASSWORD_RECOVERY", session);
    });

    expect(await screen.findByRole("heading", { name: /definir senha/i })).toBeInTheDocument();
  });

  it("permite solicitar redefinição de senha com mensagem não-enumerante", async () => {
    const user = userEvent.setup();
    renderApp(["/login"]);

    await screen.findByRole("heading", { name: /entrar no xilas finance/i });
    await user.click(screen.getByRole("button", { name: /esqueci minha senha/i }));

    expect(await screen.findByRole("heading", { name: /redefinir senha/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/e-mail/i), "convidado@example.com");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() => {
      expect(mockedAuthApi.resetPasswordForEmail).toHaveBeenCalledWith(
        "convidado@example.com",
        `${window.location.origin}/definir-senha`,
      );
    });
    expect(
      await screen.findByText(/se este e-mail estiver cadastrado, você receberá um link/i),
    ).toBeInTheDocument();
  });
});
