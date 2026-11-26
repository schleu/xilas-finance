import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().pipe(z.email("Informe um e-mail válido.")),
  password: z.string().min(1, "Informe sua senha."),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().pipe(z.email("Informe um e-mail válido.")),
});

export const setPasswordSchema = z
  .object({
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
