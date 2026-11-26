import { NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/useAuth";

const navLinks = [
  { path: "/", label: "Início" },
  { path: "/contas", label: "Contas" },
  { path: "/categorias", label: "Categorias" },
  { path: "/chat", label: "Chat" },
];

export function AppLayout() {
  const { session, signOut } = useAuth();

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-4 sm:px-6">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Pular para o conteúdo principal
      </a>
      <header className="mb-6 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-lg font-semibold">Xilas Finance</span>
          <nav
            aria-label="Navegação principal"
            className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
          >
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.path === "/"}
                className={({ isActive }) =>
                  [
                    "rounded-md px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-muted font-medium text-foreground"
                      : "hover:bg-muted/60 hover:text-foreground",
                  ].join(" ")
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          {session?.user.email && (
            <span className="truncate text-sm text-muted-foreground">{session.user.email}</span>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
    </div>
  );
}
