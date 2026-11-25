import { describe, expect, it } from "vitest";
import { clampDueDate, formatDateBR, lastDayOfMonth, monthRange } from "./dates";

describe("dates", () => {
  it("calcula o último dia do mês, incluindo ano bissexto", () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28);
    expect(lastDayOfMonth(2028, 2)).toBe(29);
    expect(lastDayOfMonth(2026, 4)).toBe(30);
    expect(lastDayOfMonth(2026, 12)).toBe(31);
  });
  it("ajusta o dia de vencimento em meses curtos", () => {
    expect(clampDueDate(2026, 2, 31)).toBe("2026-02-28");
    expect(clampDueDate(2026, 4, 31)).toBe("2026-04-30");
    expect(clampDueDate(2026, 5, 10)).toBe("2026-05-10");
  });
  it("formata data sem deslocar o dia", () => {
    expect(formatDateBR("2026-12-01")).toBe("01/12/2026");
    expect(() => formatDateBR("01/12/2026")).toThrow();
  });
  it("devolve o intervalo do mês", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});
