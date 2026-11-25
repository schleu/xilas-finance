import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { PlaceholderPage } from "./PlaceholderPage";

const queryClient = new QueryClient();

// Cada rota nasce como placeholder e é substituída pela tarefa indicada em specs/001-core/tasks.md.
const routes = [
  { path: "/", label: "Início", task: "T-13…T-15", spec: "US-1" },
  { path: "/contas", label: "Contas", task: "T-09…T-11", spec: "US-2 / US-5" },
  { path: "/categorias", label: "Categorias", task: "T-07", spec: "US-3" },
  { path: "/chat", label: "Chat", task: "T-20…T-24", spec: "US-4" },
  { path: "/login", label: "Entrar", task: "T-06", spec: "US-0" },
];

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="mx-auto min-h-screen max-w-5xl p-4">
          <header className="mb-6 flex flex-wrap items-center gap-4 border-b pb-4">
            <h1 className="text-lg font-semibold">Xilas Finance</h1>
            <nav className="flex gap-3 text-sm text-muted-foreground">
              {routes.map((r) => (
                <NavLink
                  key={r.path}
                  to={r.path}
                  className={({ isActive }) => (isActive ? "font-medium text-foreground" : "")}
                >
                  {r.label}
                </NavLink>
              ))}
            </nav>
          </header>
          <main>
            <Routes>
              {routes.map((r) => (
                <Route
                  key={r.path}
                  path={r.path}
                  element={<PlaceholderPage title={r.label} task={r.task} spec={r.spec} />}
                />
              ))}
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
