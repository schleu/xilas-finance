import { useSearchParams } from "react-router-dom";
import { BanksSection } from "@/features/banks/components/BanksSection";
import { CategoriesPage } from "@/features/categories/components/CategoriesPage";
import { StoresSection } from "@/features/stores/components/StoresSection";

type SettingsTab = "categorias" | "lojas" | "bancos";

const TABS: ReadonlyArray<{ id: SettingsTab; label: string }> = [
  { id: "categorias", label: "Categorias" },
  { id: "lojas", label: "Lojas" },
  { id: "bancos", label: "Bancos" },
];

function parseTab(value: string | null): SettingsTab {
  if (value === "lojas" || value === "bancos") return value;
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
          Gerencie suas categorias, lojas e bancos em um só lugar.
        </p>
      </div>

      <nav
        aria-label="Submenu de configurações"
        className="flex flex-wrap gap-1.5 border-b pb-3"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => selectTab(tab.id)}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "categorias" && <CategoriesPage />}
      {activeTab === "lojas" && <StoresSection />}
      {activeTab === "bancos" && <BanksSection />}
    </section>
  );
}
