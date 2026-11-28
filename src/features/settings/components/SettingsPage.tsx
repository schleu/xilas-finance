import { Landmark, Palette, Store, Tag, type LucideIcon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { ThemeToggle } from "@/app/ThemeToggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BanksSection } from "@/features/banks/components/BanksSection";
import { CategoriesPage } from "@/features/categories/components/CategoriesPage";
import { StoresSection } from "@/features/stores/components/StoresSection";

type SettingsTab = "categorias" | "lojas" | "bancos" | "aparencia";

const TABS: ReadonlyArray<{ id: SettingsTab; label: string; icon: LucideIcon }> = [
  { id: "categorias", label: "Categorias", icon: Tag },
  { id: "lojas", label: "Lojas", icon: Store },
  { id: "bancos", label: "Bancos", icon: Landmark },
  { id: "aparencia", label: "Aparência", icon: Palette },
];

function parseTab(value: string | null): SettingsTab {
  if (value === "lojas" || value === "bancos" || value === "aparencia") return value;
  return "categorias";
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get("aba"));

  const selectTab = (tab: SettingsTab) => {
    setSearchParams({ aba: tab }, { replace: true });
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie suas categorias, lojas, bancos e aparência do aplicativo.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-start">
        <aside>
          <nav
            aria-label="Submenu de configurações"
            className="flex flex-row gap-1 overflow-x-auto rounded-lg border bg-card p-1.5 md:flex-col"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => selectTab(tab.id)}
                  className={[
                    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          {activeTab === "categorias" && <CategoriesPage />}
          {activeTab === "lojas" && <StoresSection />}
          {activeTab === "bancos" && <BanksSection />}
          {activeTab === "aparencia" && (
            <Card>
              <CardHeader>
                <CardTitle>Aparência</CardTitle>
                <CardDescription>
                  Escolha entre o tema claro, escuro ou seguir a preferência do seu sistema.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Tema do aplicativo</p>
                  <p className="text-xs text-muted-foreground">
                    Sua preferência fica salva automaticamente neste navegador.
                  </p>
                </div>
                <ThemeToggle />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
