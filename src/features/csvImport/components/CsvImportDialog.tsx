import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Bank } from "@/features/banks/api/banksApi";
import { BILLS_QUERY_KEY } from "@/features/bills/hooks/useBills";
import type { BillInput } from "@/features/bills/schemas/billSchema";
import type { Category } from "@/features/categories/api/categoriesApi";
import {
  generateBillsCsvTemplate,
  generateIncomesCsvTemplate,
  parseAndValidateBillsCsv,
  parseAndValidateIncomesCsv,
  type CsvInvalidRow,
} from "@/features/csvImport/lib/csvParser";
import { DASHBOARD_QUERY_KEY } from "@/features/dashboard/hooks/useDashboard";
import type { IncomeType } from "@/features/incomes/api/incomesApi";
import { INCOMES_QUERY_KEY } from "@/features/incomes/hooks/useIncomes";
import type { IncomeInput } from "@/features/incomes/schemas/incomeSchema";
import type { Store } from "@/features/stores/api/storesApi";
import { getSupabase } from "@/lib/supabase";

type Props =
  | {
      mode: "bills";
      categories: Category[];
      stores?: Store[];
      banks?: Bank[];
      onClose: () => void;
    }
  | {
      mode: "incomes";
      incomeTypes: IncomeType[];
      banks?: Bank[];
      onClose: () => void;
    };

function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function CsvImportDialog(props: Props) {
  const queryClient = useQueryClient();
  const [validRows, setValidRows] = useState<Array<BillInput | IncomeInput>>([]);
  const [invalidRows, setInvalidRows] = useState<CsvInvalidRow[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const isBills = props.mode === "bills";

  const handleDownloadTemplate = () => {
    if (isBills) {
      triggerDownload("modelo-despesas.csv", generateBillsCsvTemplate());
    } else {
      triggerDownload("modelo-rendas.csv", generateIncomesCsvTemplate());
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setStatusMessage(null);
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    if (props.mode === "bills") {
      const result = parseAndValidateBillsCsv(text, {
        categories: props.categories,
        stores: props.stores,
        banks: props.banks,
      });
      setValidRows(result.validRows);
      setInvalidRows(result.invalidRows);
    } else {
      const result = parseAndValidateIncomesCsv(text, {
        incomeTypes: props.incomeTypes,
        banks: props.banks,
      });
      setValidRows(result.validRows);
      setInvalidRows(result.invalidRows);
    }
    setHasParsed(true);
  };

  const handleConfirmImport = async () => {
    if (validRows.length === 0) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const table = isBills ? "bills" : "incomes";
      const { error } = await getSupabase().from(table).insert(validRows);
      if (error) {
        throw new Error(error.message);
      }
      void queryClient.invalidateQueries({ queryKey: isBills ? BILLS_QUERY_KEY : INCOMES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
      setStatusMessage(`${validRows.length} registro(s) importado(s) com sucesso.`);
      setValidRows([]);
      setInvalidRows([]);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Não foi possível concluir a importação.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar {isBills ? "despesas" : "rendas"} via CSV</CardTitle>
        <CardDescription>
          Baixe o arquivo modelo, preencha seus lançamentos e envie para validação antes de salvar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Baixar modelo CSV
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={props.onClose}>
            Fechar
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="csv-upload-input">Arquivo CSV</Label>
          <Input
            id="csv-upload-input"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void handleFileChange(e)}
          />
        </div>

        {hasParsed && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
            <p>
              <strong>{validRows.length}</strong> linha(s) válida(s) ·{" "}
              <strong className={invalidRows.length > 0 ? "text-destructive" : undefined}>
                {invalidRows.length}
              </strong>{" "}
              com erro
            </p>

            {invalidRows.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-destructive">
                {invalidRows.map((row) => (
                  <li key={row.lineNumber}>
                    Linha {row.lineNumber}: {row.errors.join(" ")}
                  </li>
                ))}
              </ul>
            )}

            <Button
              type="button"
              size="sm"
              disabled={validRows.length === 0 || isImporting}
              onClick={() => void handleConfirmImport()}
            >
              <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {isImporting
                ? "Importando..."
                : `Confirmar importação (${validRows.length})`}
            </Button>
          </div>
        )}

        {statusMessage && (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {statusMessage}
          </p>
        )}
        {importError && (
          <p role="alert" className="text-sm text-destructive">
            {importError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
