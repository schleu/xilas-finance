import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Download, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Bank } from "@/features/banks/api/banksApi";
import { BILLS_QUERY_KEY } from "@/features/bills/hooks/useBills";
import type { BillInput } from "@/features/bills/schemas/billSchema";
import type { Category } from "@/features/categories/api/categoriesApi";
import {
  generateBillsCsvTemplate,
  generateIncomesCsvTemplate,
  parseAndValidateBillsMatrix,
  parseAndValidateIncomesMatrix,
  readSpreadsheetFile,
  type SpreadsheetPreviewRow,
} from "@/features/csvImport/lib/csvParser";
import { DASHBOARD_QUERY_KEY } from "@/features/dashboard/hooks/useDashboard";
import type { IncomeType } from "@/features/incomes/api/incomesApi";
import { INCOMES_QUERY_KEY } from "@/features/incomes/hooks/useIncomes";
import type { IncomeInput } from "@/features/incomes/schemas/incomeSchema";
import type { Store } from "@/features/stores/api/storesApi";
import { getSupabase } from "@/lib/supabase";

type Props =
  | {
      open?: boolean;
      mode: "bills";
      categories: Category[];
      stores?: Store[];
      banks?: Bank[];
      onClose: () => void;
    }
  | {
      open?: boolean;
      mode: "incomes";
      incomeTypes: IncomeType[];
      banks?: Bank[];
      onClose: () => void;
    };

const BILL_COLUMNS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "descricao", label: "Descrição" },
  { key: "empresa", label: "Empresa" },
  { key: "categoria", label: "Categoria" },
  { key: "valor", label: "Valor (R$)" },
  { key: "vencimento", label: "Vencimento" },
  { key: "mes_referencia", label: "Mês Ref." },
  { key: "tipo_pagamento", label: "Pagamento" },
  { key: "status", label: "Status" },
  { key: "banco", label: "Banco" },
];

const INCOME_COLUMNS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "descricao", label: "Descrição" },
  { key: "valor", label: "Valor (R$)" },
  { key: "data", label: "Data" },
  { key: "natureza", label: "Natureza" },
  { key: "tipo_renda", label: "Tipo" },
  { key: "banco", label: "Banco" },
];

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
  const [previewRows, setPreviewRows] = useState<Array<SpreadsheetPreviewRow<BillInput | IncomeInput>>>([]);
  const [validRows, setValidRows] = useState<Array<BillInput | IncomeInput>>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [hasParsed, setHasParsed] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const isBills = props.mode === "bills";
  const columns = isBills ? BILL_COLUMNS : INCOME_COLUMNS;
  const invalidCount = previewRows.filter((row) => !row.isValid).length;

  const handleDownloadTemplate = () => {
    if (props.mode === "bills") {
      triggerDownload("modelo-despesas.csv", generateBillsCsvTemplate(props.categories));
    } else {
      triggerDownload("modelo-rendas.csv", generateIncomesCsvTemplate(props.incomeTypes));
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setStatusMessage(null);
    setFileError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const matrix = await readSpreadsheetFile(file);
      if (props.mode === "bills") {
        const result = parseAndValidateBillsMatrix(matrix, {
          categories: props.categories,
          stores: props.stores,
          banks: props.banks,
        });
        setPreviewRows(result.rows);
        setValidRows(result.validRows);
        if (result.rows.length === 0 && result.invalidRows.length > 0) {
          setFileError(result.invalidRows[0]?.errors.join(" ") ?? "Arquivo sem linhas válidas.");
        }
      } else {
        const result = parseAndValidateIncomesMatrix(matrix, {
          incomeTypes: props.incomeTypes,
          banks: props.banks,
        });
        setPreviewRows(result.rows);
        setValidRows(result.validRows);
        if (result.rows.length === 0 && result.invalidRows.length > 0) {
          setFileError(result.invalidRows[0]?.errors.join(" ") ?? "Arquivo sem linhas válidas.");
        }
      }
      setHasParsed(true);
    } catch {
      setPreviewRows([]);
      setValidRows([]);
      setFileError("Não foi possível ler o arquivo. Envie um arquivo CSV, XLS ou XLSX válido.");
      setHasParsed(true);
    }
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
      void queryClient.invalidateQueries({
        queryKey: isBills ? BILLS_QUERY_KEY : INCOMES_QUERY_KEY,
      });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
      setStatusMessage(`${validRows.length} registro(s) importado(s) com sucesso.`);
      setValidRows([]);
      setPreviewRows([]);
      setHasParsed(false);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Não foi possível concluir a importação.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog
      open={props.open ?? true}
      onOpenChange={(isOpen) => {
        if (!isOpen) props.onClose();
      }}
    >
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Importar {isBills ? "despesas" : "rendas"}</DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV, XLS ou XLSX. Os dados são higienizados automaticamente (datas em{" "}
            <code>dd/mm/yyyy</code>) e eventuais erros são sinalizados diretamente na tabela abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="csv-upload-input">Arquivo (CSV, XLS ou XLSX)</Label>
              <Input
                id="csv-upload-input"
                type="file"
                accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => void handleFileChange(e)}
              />
            </div>

            <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Baixar modelo CSV
            </Button>
          </div>

          {fileError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {fileError}
            </p>
          )}

          {hasParsed && previewRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p>
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {validRows.length}
                  </strong>{" "}
                  linha(s) válida(s) ·{" "}
                  <strong className={invalidCount > 0 ? "text-destructive" : undefined}>
                    {invalidCount}
                  </strong>{" "}
                  com erro
                </p>
              </div>

              <div className="max-h-80 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Linha</TableHead>
                      <TableHead className="w-10">OK</TableHead>
                      {columns.map((col) => (
                        <TableHead key={col.key}>{col.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row) => (
                      <TableRow
                        key={row.lineNumber}
                        className={row.isValid ? undefined : "bg-destructive/5"}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {row.lineNumber}
                        </TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <CheckCircle2
                              aria-label="Linha válida"
                              className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                            />
                          ) : (
                            <AlertCircle
                              aria-label={`Linha ${row.lineNumber} com erro`}
                              className="h-4 w-4 text-destructive"
                            />
                          )}
                        </TableCell>
                        {columns.map((col) => {
                          const cellValue = row.cells[col.key] ?? "";
                          const cellError = row.fieldErrors[col.key];
                          return (
                            <TableCell
                              key={col.key}
                              className={
                                cellError
                                  ? "border border-destructive/40 bg-destructive/10 align-top"
                                  : "align-top"
                              }
                            >
                              <div className="text-xs sm:text-sm">
                                {cellValue || <span className="text-muted-foreground">—</span>}
                              </div>
                              {cellError && (
                                <p className="mt-1 text-xs font-medium text-destructive">
                                  {cellError}
                                </p>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={props.onClose}>
            Fechar
          </Button>
          {hasParsed && (
            <Button
              type="button"
              disabled={validRows.length === 0 || isImporting}
              onClick={() => void handleConfirmImport()}
            >
              <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {isImporting ? "Importando..." : `Confirmar importação (${validRows.length})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
