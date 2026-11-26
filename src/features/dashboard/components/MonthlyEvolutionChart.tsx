import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { MonthlyEvolutionPoint } from "@/features/dashboard/api/dashboardApi";
import { formatShortMonthPT } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

const chartConfig = {
  paid_total_cents: {
    label: "Total pago",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

interface MonthlyEvolutionChartProps {
  data: MonthlyEvolutionPoint[];
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
}

export function MonthlyEvolutionChart({
  data,
  isLoading,
  isError,
  error,
}: MonthlyEvolutionChartProps) {
  const chartData = data.map((point) => ({
    month: point.month,
    label: formatShortMonthPT(point.month),
    paid_total_cents: point.paid_total_cents,
  }));

  const hasAnySpending = chartData.some((item) => item.paid_total_cents > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução mensal</CardTitle>
        <CardDescription>Últimos 6 meses (somente lançamentos pagos)</CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            Não foi possível carregar a evolução mensal.{" "}
            {error instanceof Error ? error.message : ""}
          </div>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando evolução mensal...</p>
        ) : !hasAnySpending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum gasto pago nos últimos 6 meses.
          </p>
        ) : (
          <div className="space-y-4">
            <ChartContainer config={chartConfig} className="h-[240px] w-full aspect-auto">
              <BarChart
                data={chartData}
                margin={{ left: 8, right: 8, top: 8, bottom: 4 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={80}
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
                <Bar
                  dataKey="paid_total_cents"
                  fill="var(--color-paid_total_cents)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ChartContainer>

            <ul
              aria-label="Totais pagos por mês"
              className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3"
            >
              {chartData.map((item) => (
                <li
                  key={item.month}
                  className="flex items-center justify-between gap-2 text-muted-foreground"
                >
                  <span>{item.label}</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {formatBRL(item.paid_total_cents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
