import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/components/AuthProvider";
import { LoginPage } from "@/features/auth/components/LoginPage";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { SetPasswordPage } from "@/features/auth/components/SetPasswordPage";
import { BillsPage } from "@/features/bills/components/BillsPage";
import { CategoriesPage } from "@/features/categories/components/CategoriesPage";
import { ChatPage } from "@/features/chat/components/ChatPage";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { AppLayout } from "./AppLayout";

const queryClient = new QueryClient();

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/definir-senha" element={<SetPasswordPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/contas" element={<BillsPage />} />
          <Route path="/categorias" element={<CategoriesPage />} />
          <Route path="/chat" element={<ChatPage />} />
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
