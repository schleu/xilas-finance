import {
  Home,
  LogOut,
  Menu,
  MessageSquare,
  Receipt,
  Settings,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { getUserInitials, useUserProfile } from "@/features/auth/hooks/useUserProfile";

const navLinks: ReadonlyArray<{ path: string; label: string; icon: LucideIcon }> = [
  { path: "/", label: "Início", icon: Home },
  { path: "/despesas", label: "Despesas", icon: Receipt },
  { path: "/rendas", label: "Rendas", icon: Wallet },
  { path: "/chat", label: "Chat", icon: MessageSquare },
  { path: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppLayout() {
  const { session, signOut } = useAuth();
  const location = useLocation();
  const currentRouteKey = `${location.pathname}${location.search}`;
  const [openMenuRouteKey, setOpenMenuRouteKey] = useState<string | null>(null);
  const mobileMenuOpen = openMenuRouteKey === currentRouteKey;

  const user = session?.user;
  const { data: profileDisplayName } = useUserProfile(user?.id);
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const metaName =
    (typeof metadata?.display_name === "string" && metadata.display_name) ||
    (typeof metadata?.full_name === "string" && metadata.full_name) ||
    null;

  const displayName = profileDisplayName || metaName || null;
  const email = user?.email ?? null;
  const initials = getUserInitials(displayName, email);
  const userLabel = displayName || email || "Usuário";

  // Close mobile menu on Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuRouteKey(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-4 sm:px-6">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Pular para o conteúdo principal
      </a>

      <header className="mb-6 border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-5">
            <Link
              to="/"
              className="rounded-md text-lg font-semibold tracking-tight transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Xilas Finance
            </Link>

            <nav
              aria-label="Navegação principal"
              className="hidden items-center gap-1 text-sm text-muted-foreground md:flex"
            >
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    end={link.path === "/"}
                    className={({ isActive }) =>
                      [
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActive
                          ? "bg-muted font-medium text-foreground"
                          : "hover:bg-muted/60 hover:text-foreground",
                      ].join(" ")
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{link.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div
              role="img"
              aria-label={`Usuário: ${userLabel}`}
              title={userLabel}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground select-none"
            >
              {initials}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => void signOut()}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="md:hidden"
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
              onClick={() =>
                setOpenMenuRouteKey((prev) => (prev === currentRouteKey ? null : currentRouteKey))
              }
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            id="mobile-nav"
            aria-label="Menu mobile"
            className="mt-3 space-y-1 rounded-lg border bg-card p-2 shadow-sm md:hidden"
          >
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end={link.path === "/"}
                  onClick={() => setOpenMenuRouteKey(null)}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    ].join(" ")
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
            <div className="border-t pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  setOpenMenuRouteKey(null);
                  void signOut();
                }}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sair
              </Button>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
    </div>
  );
}
