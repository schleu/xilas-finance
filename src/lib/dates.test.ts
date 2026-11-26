import { describe, expect, it } from "vitest";
import {
  clampDueDate,
  formatDateBR,
  formatMonthYearPT,
  formatShortMonthPT,
  lastDayOfMonth,
  monthRange,
  shiftMonth,
} from "./dates";

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
  it("avança e retrocede meses cruzando virada de ano", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-11", -5)).toBe("2026-06");
  });
  it("formata mês e ano em pt-BR sem deslocamento de fuso", () => {
    expect(formatMonthYearPT("2026-11")).toBe("Novembro de 2026");
    expect(formatMonthYearPT("2026-01")).toBe("Janeiro de 2026");
  });
  it("formata mês curto para eixos de gráficos", () => {
    expect(formatShortMonthPT("2026-11-01")).toBe("Nov/26");
    expect(formatShortMonthPT("2026-01")).toBe("Jan/26");
  });
});
