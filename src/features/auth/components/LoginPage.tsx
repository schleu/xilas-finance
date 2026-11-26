import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  loginSchema,
  resetPasswordSchema,
  type LoginInput,
  type ResetPasswordInput,
} from "@/features/auth/schemas/authSchemas";

type Mode = "login" | "reset";

export function LoginPage() {
  const { session, isLoading, needsPasswordSetup, signIn, requestPasswordReset } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>("login");
  const [formError, setFormError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const resetForm = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "" },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p role="status" className="text-sm text-muted-foreground">
          Carregando sessão...
        </p>
      </div>
    );
  }

  if (session) {
    const fromPathname =
      (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";
    const target = needsPasswordSetup ? "/definir-senha" : fromPathname;
    return <Navigate to={target} replace />;
  }

  const handleLogin = loginForm.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn(values.email, values.password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível entrar.");
    }
  });

  const handleReset = resetForm.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await requestPasswordReset(values.email);
      setResetSent(true);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Não foi possível enviar o link de redefinição.",
      );
    }
  });

  const switchMode = (nextMode: Mode) => {
    setFormError(null);
    setResetSent(false);
    setMode(nextMode);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        {mode === "login" ? (
          <>
            <CardHeader>
              <CardTitle>
                <h1 className="text-xl font-semibold">Entrar no Xilas Finance</h1>
              </CardTitle>
              <CardDescription>
                Acesso restrito a pessoas convidadas por e-mail.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={Boolean(loginForm.formState.errors.email)}
                    {...loginForm.register("email")}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={Boolean(loginForm.formState.errors.password)}
                    {...loginForm.register("password")}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                {formError && (
                  <p role="alert" className="text-sm text-destructive">
                    {formError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginForm.formState.isSubmitting}
                >
                  {loginForm.formState.isSubmitting ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="justify-center">
              <Button type="button" variant="link" onClick={() => switchMode("reset")}>
                Esqueci minha senha
              </Button>
            </CardFooter>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>
                <h1 className="text-xl font-semibold">Redefinir senha</h1>
              </CardTitle>
              <CardDescription>
                Informe seu e-mail cadastrado para receber o link de redefinição.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleReset} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">E-mail</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={Boolean(resetForm.formState.errors.email)}
                    {...resetForm.register("email")}
                  />
                  {resetForm.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {resetForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {formError && (
                  <p role="alert" className="text-sm text-destructive">
                    {formError}
                  </p>
                )}

                {resetSent && (
                  <p role="status" className="text-sm text-muted-foreground">
                    Se este e-mail estiver cadastrado, você receberá um link para redefinir sua
                    senha.
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={resetForm.formState.isSubmitting}
                >
                  {resetForm.formState.isSubmitting ? "Enviando..." : "Enviar link"}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="justify-center">
              <Button type="button" variant="link" onClick={() => switchMode("login")}>
                Voltar para o login
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
