import { describe, expect, it } from "vitest";
import { sortRows } from "./tableSort";

interface SampleRow {
  name: string;
  amount: number;
  date: string;
  optional: string | null;
}

const sample: SampleRow[] = [
  { name: "Água", amount: 15000, date: "2026-12-07", optional: null },
  { name: "Luz", amount: 24000, date: "2026-12-01", optional: "Enel" },
  { name: "Aluguel", amount: 180000, date: "2026-12-10", optional: "Imobiliária" },
];

const accessors = {
  name: (r: SampleRow) => r.name,
  amount: (r: SampleRow) => r.amount,
  date: (r: SampleRow) => r.date,
  optional: (r: SampleRow) => r.optional,
};

describe("sortRows", () => {
  it("ordena texto em pt-BR considerando acentos", () => {
    const asc = sortRows(sample, { key: "name", direction: "asc" }, accessors);
    expect(asc.map((r) => r.name)).toEqual(["Água", "Aluguel", "Luz"]);

    const desc = sortRows(sample, { key: "name", direction: "desc" }, accessors);
    expect(desc.map((r) => r.name)).toEqual(["Luz", "Aluguel", "Água"]);
  });

  it("ordena números (centavos) corretamente", () => {
    const desc = sortRows(sample, { key: "amount", direction: "desc" }, accessors);
    expect(desc.map((r) => r.amount)).toEqual([180000, 24000, 15000]);
  });

  it("ordena datas ISO corretamente", () => {
    const asc = sortRows(sample, { key: "date", direction: "asc" }, accessors);
    expect(asc.map((r) => r.date)).toEqual(["2026-12-01", "2026-12-07", "2026-12-10"]);
  });

  it("mantém valores vazios no fim na ordenação crescente", () => {
    const asc = sortRows(sample, { key: "optional", direction: "asc" }, accessors);
    expect(asc.map((r) => r.optional)).toEqual(["Enel", "Imobiliária", null]);
  });
});
