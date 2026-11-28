import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/features/auth/components/AuthProvider";
import { LoginPage } from "@/features/auth/components/LoginPage";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { SetPasswordPage } from "@/features/auth/components/SetPasswordPage";
import { BillsPage } from "@/features/bills/components/BillsPage";
import { ChatPage } from "@/features/chat/components/ChatPage";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { IncomesPage } from "@/features/incomes/components/IncomesPage";
import { SettingsPage } from "@/features/settings/components/SettingsPage";
import { AppLayout } from "./AppLayout";
import { ThemeProvider } from "./ThemeProvider";

const queryClient = new QueryClient();

export function AppRoutes() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={150}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/definir-senha" element={<SetPasswordPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/despesas" element={<BillsPage />} />
              <Route path="/contas" element={<Navigate to="/despesas" replace />} />
              <Route path="/rendas" element={<IncomesPage />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
              <Route
                path="/categorias"
                element={<Navigate to="/configuracoes?aba=categorias" replace />}
              />
              <Route path="/chat" element={<ChatPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TooltipProvider>
    </ThemeProvider>
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
