import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { CategorySpending } from "@/features/dashboard/api/dashboardApi";
import { formatBRL } from "@/lib/money";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

const chartConfig = {
  paid_total_cents: {
    label: "Total pago",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

interface SpendingByCategoryChartProps {
  data: CategorySpending[];
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
}

export function SpendingByCategoryChart({
  data,
  isLoading,
  isError,
  error,
}: SpendingByCategoryChartProps) {
  const totalPaidCents = data.reduce((acc, item) => acc + item.paid_total_cents, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gasto por categoria</CardTitle>
        <CardDescription>Somente lançamentos pagos no mês selecionado</CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            Não foi possível carregar os gastos por categoria.{" "}
            {error instanceof Error ? error.message : ""}
          </div>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando gráfico de categorias...</p>
        ) : data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum gasto pago registrado neste mês.
          </p>
        ) : (
          <div className="space-y-4">
            <ChartContainer config={chartConfig} className="h-[240px] w-full aspect-auto">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} />
                <YAxis
                  dataKey="category_name"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatBRL(Math.round(Number(value)))}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatBRL(Math.round(Number(value)))}
                    />
                  }
                />
                <Bar dataKey="paid_total_cents" radius={[0, 6, 6, 0]}>
                  {data.map((entry, index) => (
                    <Cell
                      key={entry.category_id}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>

            <ul aria-label="Detalhamento por categoria" className="space-y-1.5 text-sm">
              {data.map((item, index) => {
                const percent =
                  totalPaidCents > 0
                    ? Math.round((item.paid_total_cents * 100) / totalPaidCents)
                    : 0;
                return (
                  <li
                    key={item.category_id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-xs"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.category_name}</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatBRL(item.paid_total_cents)}{" "}
                      <span className="text-xs text-muted-foreground">({percent}%)</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
