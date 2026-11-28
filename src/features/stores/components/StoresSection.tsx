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
import type { Store } from "@/features/stores/api/storesApi";
import {
  useCreateStore,
  useDeleteStore,
  useStores,
  useUpdateStore,
} from "@/features/stores/hooks/useStores";
import {
  STORE_SUBTYPES,
  STORE_SUBTYPE_LABELS,
  STORE_TYPES,
  STORE_TYPE_LABELS,
  storeSchema,
  type StoreSubtype,
  type StoreType,
} from "@/features/stores/schemas/storeSchema";

function hasDuplicateStoreName(stores: Store[], name: string, excludeId?: string): boolean {
  const normalized = name.trim().toLowerCase();
  return stores.some(
    (store) => store.id !== excludeId && store.name.trim().toLowerCase() === normalized,
  );
}

export function StoresSection() {
  const { data: stores = [], isLoading, error: loadError } = useStores();
  const createMutation = useCreateStore();
  const updateMutation = useUpdateStore();
  const deleteMutation = useDeleteStore();

  const [showFormModal, setShowFormModal] = useState(false);
  const [name, setName] = useState("");
  const [storeType, setStoreType] = useState<StoreType>("online");
  const [storeSubtype, setStoreSubtype] = useState<StoreSubtype>("supermarket");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingStore, setDeletingStore] = useState<Store | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setStoreType("online");
    setStoreSubtype("supermarket");
    setEditingId(null);
    setFormError(null);
    setShowFormModal(false);
  };

  const openCreateModal = () => {
    setName("");
    setStoreType("online");
    setStoreSubtype("supermarket");
    setEditingId(null);
    setFormError(null);
    setShowFormModal(true);
  };

  const startEdit = (store: Store) => {
    setFormError(null);
    setEditingId(store.id);
    setName(store.name);
    setStoreType(store.store_type);
    setStoreSubtype(store.store_subtype ?? "other");
    setShowFormModal(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsed = storeSchema.safeParse({
      name,
      store_type: storeType,
      store_subtype: storeType === "physical" ? storeSubtype : null,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    if (hasDuplicateStoreName(stores, parsed.data.name, editingId ?? undefined)) {
      setFormError("Já existe uma loja com este nome.");
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input: parsed.data });
      } else {
        await createMutation.mutateAsync(parsed.data);
      }
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar a loja.");
    }
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(id);
      setDeletingStore(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível excluir a loja.");
    }
  };

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
          Não foi possível carregar suas lojas.
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Lojas</CardTitle>
            <CardDescription>
              Cadastre lojas online e físicas (incluindo supermercados) para usar no autocomplete de
              despesas.
            </CardDescription>
          </div>
          <Button type="button" size="sm" onClick={openCreateModal}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova loja
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando lojas...
            </p>
          ) : stores.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma loja cadastrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">{store.name}</TableCell>
                    <TableCell>{STORE_TYPE_LABELS[store.store_type]}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {store.store_type === "physical" && store.store_subtype
                        ? STORE_SUBTYPE_LABELS[store.store_subtype]
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        {store.is_default ? "Padrão" : "Personalizada"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <IconTooltipButton
                          label="Editar"
                          icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                          onClick={() => startEdit(store)}
                        />
                        <IconTooltipButton
                          label="Excluir"
                          icon={<Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />}
                          onClick={() => setDeletingStore(store)}
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

      {/* Modal: Nova / Editar loja */}
      <Dialog
        open={showFormModal}
        onOpenChange={(open) => {
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar loja" : "Nova loja"}</DialogTitle>
            <DialogDescription>
              Informe o nome e a classificação da loja.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="store-name">Nome da loja *</Label>
              <Input
                id="store-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Amazon, Assaí"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="store-type">Tipo *</Label>
              <select
                id="store-type"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={storeType}
                onChange={(e) => setStoreType(e.target.value as StoreType)}
              >
                {STORE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {STORE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {storeType === "physical" && (
              <div className="space-y-1.5">
                <Label htmlFor="store-subtype">Segmento</Label>
                <select
                  id="store-subtype"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={storeSubtype}
                  onChange={(e) => setStoreSubtype(e.target.value as StoreSubtype)}
                >
                  {STORE_SUBTYPES.map((st) => (
                    <option key={st} value={st}>
                      {STORE_SUBTYPE_LABELS[st]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "Salvar alterações" : "Adicionar loja"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar exclusão */}
      <Dialog
        open={Boolean(deletingStore)}
        onOpenChange={(open) => {
          if (!open) setDeletingStore(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir loja</DialogTitle>
            <DialogDescription>
              Excluir a loja <strong>{deletingStore?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingStore(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deletingStore && void handleDelete(deletingStore.id)}
            >
              Confirmar exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
