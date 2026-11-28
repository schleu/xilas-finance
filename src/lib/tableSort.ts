import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

export type SortValue = string | number | null | undefined;

export function compareSortValues(a: SortValue, b: SortValue): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  return String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base", numeric: true });
}

export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: SortState<K> | null,
  accessors: Record<K, (row: T) => SortValue>,
): T[] {
  if (!sort) return [...rows];
  const getter = accessors[sort.key];
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => compareSortValues(getter(a), getter(b)) * factor);
}

export function useTableSort<T, K extends string>(
  rows: readonly T[],
  accessors: Record<K, (row: T) => SortValue>,
  initialSort: SortState<K> | null = null,
) {
  const [sort, setSort] = useState<SortState<K> | null>(initialSort);

  const toggleSort = (key: K) => {
    setSort((prev) => {
      if (prev && prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedRows = useMemo(() => sortRows(rows, sort, accessors), [rows, sort, accessors]);

  const getAriaSort = (key: K): "ascending" | "descending" | "none" => {
    if (!sort || sort.key !== key) return "none";
    return sort.direction === "asc" ? "ascending" : "descending";
  };

  return { sort, sortedRows, toggleSort, getAriaSort };
}
