import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { countBillsInCategory, type Category } from "@/features/categories/api/categoriesApi";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useRenameCategory,
} from "@/features/categories/hooks/useCategories";
import { categorySchema, type CategoryInput } from "@/features/categories/schemas/categorySchema";

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

  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [checkingDeleteId, setCheckingDeleteId] = useState<string | null>(null);

  const createForm = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "" },
  });

  const handleCreate = createForm.handleSubmit(async (values) => {
    setActionError(null);
    if (hasDuplicateName(categories, values.name)) {
      setActionError("Já existe uma categoria com este nome.");
      return;
    }
    try {
      await createMutation.mutateAsync(values.name);
      createForm.reset();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Não foi possível criar a categoria.",
      );
    }
  });

  const startRename = (category: Category) => {
    setActionError(null);
    setDeleteState(null);
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const handleRename = async (category: Category) => {
    setActionError(null);
    const parsed = categorySchema.safeParse({ name: editingName });
    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? "Nome inválido.");
      return;
    }
    if (hasDuplicateName(categories, parsed.data.name, category.id)) {
      setActionError("Já existe uma categoria com este nome.");
      return;
    }
    try {
      await renameMutation.mutateAsync({ id: category.id, name: parsed.data.name });
      setEditingId(null);
      setEditingName("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Não foi possível renomear a categoria.",
      );
    }
  };

  const startDelete = async (category: Category) => {
    setActionError(null);
    setEditingId(null);
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

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Categorias</h1>
        <p className="text-sm text-muted-foreground">
          Organize seus gastos criando, renomeando ou removendo categorias.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova categoria</CardTitle>
          <CardDescription>Nomes são únicos por conta (sem diferenciar maiúsculas).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="new-category-name">Nova categoria</Label>
              <Input
                id="new-category-name"
                placeholder="Ex.: Lazer, Saúde, Educação"
                aria-invalid={Boolean(createForm.formState.errors.name)}
                {...createForm.register("name")}
              />
              {createForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {actionError && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar suas categorias.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Suas categorias</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando categorias...
            </p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
          ) : (
            <ul className="divide-y">
              {categories.map((category) => {
                const isEditing = editingId === category.id;
                const isDeleting = deleteState?.category.id === category.id;
                const replacementOptions = categories.filter((c) => c.id !== category.id);

                return (
                  <li key={category.id} className="py-3 first:pt-0 last:pb-0">
                    {isEditing ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex-1 space-y-1">
                          <Label htmlFor={`rename-${category.id}`}>Novo nome</Label>
                          <Input
                            id={`rename-${category.id}`}
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={renameMutation.isPending}
                            onClick={() => void handleRename(category)}
                          >
                            Salvar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              setActionError(null);
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{category.name}</span>
                          {category.is_default && (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                              Padrão
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => startRename(category)}
                          >
                            Renomear
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={checkingDeleteId === category.id}
                            onClick={() => void startDelete(category)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </div>
                    )}

                    {isDeleting && deleteState && (
                      <div className="mt-3 space-y-3 rounded-md border bg-muted/40 p-3">
                        {deleteState.billCount > 0 ? (
                          <>
                            <p className="text-sm">
                              Esta categoria possui{" "}
                              <strong>{deleteState.billCount} conta(s) vinculada(s)</strong>.
                              Escolha outra categoria para reatribuir antes de excluir.
                            </p>
                            {replacementOptions.length === 0 ? (
                              <p className="text-sm text-destructive">
                                Crie outra categoria antes de excluir a última em uso.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                <Label htmlFor={`reassign-${category.id}`}>
                                  Reatribuir contas para
                                </Label>
                                <select
                                  id={`reassign-${category.id}`}
                                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                  value={deleteState.reassignToId}
                                  onChange={(e) =>
                                    setDeleteState({
                                      ...deleteState,
                                      reassignToId: e.target.value,
                                    })
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
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={
                                  deleteMutation.isPending ||
                                  replacementOptions.length === 0 ||
                                  !deleteState.reassignToId
                                }
                                onClick={() => void confirmDelete()}
                              >
                                Reatribuir e excluir
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteState(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm">
                              Deseja realmente excluir a categoria{" "}
                              <strong>{category.name}</strong>?
                            </p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={deleteMutation.isPending}
                                onClick={() => void confirmDelete()}
                              >
                                Confirmar exclusão
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteState(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
