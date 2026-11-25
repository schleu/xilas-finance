/**
 * Datas de vencimento são "YYYY-MM-DD" (tipo `date` do Postgres), sem fuso.
 * Nunca passe por `new Date("YYYY-MM-DD")`, que interpreta como UTC e desloca o dia.
 */

export function lastDayOfMonth(year: number, month: number): number {
  // month: 1-12
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Dia de vencimento ajustado ao mês (31 vira 28/29/30 em meses curtos). Espelha o SQL do plano. */
export function clampDueDate(year: number, month: number, dueDay: number): string {
  const day = Math.min(dueDay, lastDayOfMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatDateBR(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`Data inválida: ${isoDate}`);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Primeiro e último dia de um mês de referência "YYYY-MM". */
export function monthRange(month: string): { from: string; to: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error(`Mês inválido: ${month}`);
  const year = Number(match[1]);
  const m = Number(match[2]);
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDayOfMonth(year, m)).padStart(2, "0")}`,
  };
}
