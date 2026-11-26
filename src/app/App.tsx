import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/components/AuthProvider";
import { LoginPage } from "@/features/auth/components/LoginPage";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { SetPasswordPage } from "@/features/auth/components/SetPasswordPage";
import { BillsPage } from "@/features/bills/components/BillsPage";
import { CategoriesPage } from "@/features/categories/components/CategoriesPage";
import { AppLayout } from "./AppLayout";
import { PlaceholderPage } from "./PlaceholderPage";

const queryClient = new QueryClient();

// Cada rota nasce como placeholder e é substituída pela tarefa indicada em specs/001-core/tasks.md.
const placeholderPages = [
  { path: "/", label: "Início", task: "T-13…T-15", spec: "US-1" },
  { path: "/chat", label: "Chat", task: "T-20…T-24", spec: "US-4" },
];

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/definir-senha" element={<SetPasswordPage />} />
        <Route element={<AppLayout />}>
          {placeholderPages.map((page) => (
            <Route
              key={page.path}
              path={page.path}
              element={<PlaceholderPage title={page.label} task={page.task} spec={page.spec} />}
            />
          ))}
          <Route path="/contas" element={<BillsPage />} />
          <Route path="/categorias" element={<CategoriesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
