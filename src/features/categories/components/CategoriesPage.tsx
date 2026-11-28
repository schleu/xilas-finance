import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconTooltipButton } from "@/components/ui/icon-tooltip-button";
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
import { countBillsInCategory, type Category } from "@/features/categories/api/categoriesApi";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useRenameCategory,
} from "@/features/categories/hooks/useCategories";
import { categorySchema } from "@/features/categories/schemas/categorySchema";

type DeleteState = {
  category: Category;
  billCount: number;
  reassignToId: string;
};

function hasDuplicateName(categories: Category[], name: string, excludeId?: string): boolean {
  const normalized = name.trim().toLowerCase();
  return categories.some(
    (category) => category.id !== excludeId && category.name.trim().toLowerCase() === normalized,
  );
}

export function CategoriesPage() {
  const { data: categories = [], isLoading, error: loadError } = useCategories();
  const createMutation = useCreateCategory();
  const renameMutation = useRenameCategory();
  const deleteMutation = useDeleteCategory();

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [checkingDeleteId, setCheckingDeleteId] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingCategory(null);
    setNameInput("");
    setFormError(null);
    setShowFormModal(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setNameInput(category.name);
    setFormError(null);
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingCategory(null);
    setNameInput("");
    setFormError(null);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsed = categorySchema.safeParse({ name: nameInput });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Nome inválido.");
      return;
    }

    if (hasDuplicateName(categories, parsed.data.name, editingCategory?.id)) {
      setFormError("Já existe uma categoria com este nome.");
      return;
    }

    try {
      if (editingCategory) {
        await renameMutation.mutateAsync({ id: editingCategory.id, name: parsed.data.name });
      } else {
        await createMutation.mutateAsync(parsed.data.name);
      }
      closeFormModal();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Não foi possível salvar a categoria.",
      );
    }
  };

  const startDelete = async (category: Category) => {
    setActionError(null);
    setCheckingDeleteId(category.id);
    try {
      const billCount = await countBillsInCategory(category.id);
      setDeleteState({ category, billCount, reassignToId: "" });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Não foi possível verificar o uso da categoria.",
      );
    } finally {
      setCheckingDeleteId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteState) return;
    setActionError(null);
    const { category, billCount, reassignToId } = deleteState;
    if (billCount > 0 && !reassignToId) {
      setActionError("Selecione uma categoria para reatribuir as contas.");
      return;
    }
    try {
      await deleteMutation.mutateAsync({
        id: category.id,
        reassignToCategoryId: billCount > 0 ? reassignToId : undefined,
      });
      setDeleteState(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Não foi possível excluir a categoria.",
      );
    }
  };

  const replacementOptions = deleteState
    ? categories.filter((c) => c.id !== deleteState.category.id)
    : [];

  return (
    <div className="space-y-4">
      {actionError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {actionError}
        </p>
      )}

      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar suas categorias.
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Categorias</CardTitle>
            <CardDescription>
              Organize suas despesas criando, renomeando ou removendo categorias.
            </CardDescription>
          </div>
          <Button type="button" size="sm" onClick={openCreateModal}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova categoria
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando categorias...
            </p>
          ) : categories.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma categoria cadastrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        {category.is_default ? "Padrão" : "Personalizada"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <IconTooltipButton
                          label="Editar"
                          icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                          onClick={() => openEditModal(category)}
                        />
                        <IconTooltipButton
                          label="Excluir"
                          icon={<Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />}
                          disabled={checkingDeleteId === category.id}
                          onClick={() => void startDelete(category)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal: Nova / Editar categoria */}
      <Dialog
        open={showFormModal}
        onOpenChange={(open) => {
          if (!open) closeFormModal();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>
              Nomes são únicos por conta (sem diferenciar maiúsculas).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleSave(e)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="category-name-input">Nome da categoria *</Label>
              <Input
                id="category-name-input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Ex.: Lazer, Saúde, Educação"
              />
            </div>

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeFormModal}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || renameMutation.isPending}
              >
                {editingCategory ? "Salvar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar exclusão / reatribuição */}
      <Dialog
        open={Boolean(deleteState)}
        onOpenChange={(open) => {
          if (!open) setDeleteState(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir categoria</DialogTitle>
            <DialogDescription>
              {deleteState && deleteState.billCount > 0 ? (
                <>
                  Esta categoria possui{" "}
                  <strong>{deleteState.billCount} conta(s) vinculada(s)</strong>. Escolha outra
                  categoria para reatribuir antes de excluir.
                </>
              ) : (
                <>
                  Deseja realmente excluir a categoria{" "}
                  <strong>{deleteState?.category.name}</strong>?
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {deleteState && deleteState.billCount > 0 && (
            <div className="space-y-2">
              {replacementOptions.length === 0 ? (
                <p className="text-sm text-destructive">
                  Crie outra categoria antes de excluir a última em uso.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="reassign-category-select">Reatribuir contas para</Label>
                  <select
                    id="reassign-category-select"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={deleteState.reassignToId}
                    onChange={(e) =>
                      setDeleteState({ ...deleteState, reassignToId: e.target.value })
                    }
                  >
                    <option value="">Selecione uma categoria...</option>
                    {replacementOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteState(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                deleteMutation.isPending ||
                (Boolean(deleteState && deleteState.billCount > 0) &&
                  (replacementOptions.length === 0 || !deleteState?.reassignToId))
              }
              onClick={() => void confirmDelete()}
            >
              {deleteState && deleteState.billCount > 0
                ? "Reatribuir e excluir"
                : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
