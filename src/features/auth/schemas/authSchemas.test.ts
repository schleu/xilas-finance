import { describe, expect, it } from "vitest";
import { loginSchema, resetPasswordSchema, setPasswordSchema } from "./authSchemas";

describe("authSchemas", () => {
  describe("loginSchema", () => {
    it("aceita e-mail válido com espaços nas pontas e senha preenchida", () => {
      const result = loginSchema.safeParse({
        email: "  maria@example.com  ",
        password: "secret",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          email: "maria@example.com",
          password: "secret",
        });
      }
    });

    it("rejeita e-mail inválido", () => {
      const result = loginSchema.safeParse({
        email: "nao-e-email",
        password: "secret",
      });
      expect(result.success).toBe(false);
    });

    it("rejeita senha vazia", () => {
      const result = loginSchema.safeParse({
        email: "maria@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("resetPasswordSchema", () => {
    it("aceita e faz trim de e-mail válido", () => {
      const result = resetPasswordSchema.safeParse({
        email: "  joao@example.com ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("joao@example.com");
      }
    });

    it("rejeita e-mail vazio ou inválido", () => {
      expect(resetPasswordSchema.safeParse({ email: "" }).success).toBe(false);
      expect(resetPasswordSchema.safeParse({ email: "abc" }).success).toBe(false);
    });
  });

  describe("setPasswordSchema", () => {
    it("aceita senha com 6 ou mais caracteres e confirmação igual", () => {
      const result = setPasswordSchema.safeParse({
        password: "nova-senha-123",
        confirmPassword: "nova-senha-123",
      });
      expect(result.success).toBe(true);
    });

    it("rejeita senha com menos de 6 caracteres", () => {
      const result = setPasswordSchema.safeParse({
        password: "12345",
        confirmPassword: "12345",
      });
      expect(result.success).toBe(false);
    });

    it("rejeita confirmação diferente da senha", () => {
      const result = setPasswordSchema.safeParse({
        password: "senha-123",
        confirmPassword: "outra-senha",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("confirmPassword");
      }
    });
  });
});
