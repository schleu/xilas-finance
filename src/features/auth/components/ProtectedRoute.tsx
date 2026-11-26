import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";

export function ProtectedRoute() {
  const { session, isLoading, needsPasswordSetup } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p role="status" className="text-sm text-muted-foreground">
          Carregando sessão...
        </p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (needsPasswordSetup && location.pathname !== "/definir-senha") {
    return <Navigate to="/definir-senha" replace />;
  }

  return <Outlet />;
}
