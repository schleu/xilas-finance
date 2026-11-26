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
    <div className="mx-auto min-h-screen max-w-5xl p-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-lg font-semibold">Xilas Finance</span>
          <nav aria-label="Navegação principal" className="flex gap-3 text-sm text-muted-foreground">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.path === "/"}
                className={({ isActive }) => (isActive ? "font-medium text-foreground" : "")}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {session?.user.email && (
            <span className="text-sm text-muted-foreground">{session.user.email}</span>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
