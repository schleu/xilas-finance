import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const [name, setName] = useState("");
  const [storeType, setStoreType] = useState<StoreType>("online");
  const [storeSubtype, setStoreSubtype] = useState<StoreSubtype>("supermarket");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setStoreType("online");
    setStoreSubtype("supermarket");
    setEditingId(null);
    setActionError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError(null);

    const parsed = storeSchema.safeParse({
      name,
      store_type: storeType,
      store_subtype: storeType === "physical" ? storeSubtype : null,
    });
    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    if (hasDuplicateStoreName(stores, parsed.data.name, editingId ?? undefined)) {
      setActionError("Já existe uma loja com este nome.");
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
      setActionError(error instanceof Error ? error.message : "Não foi possível salvar a loja.");
    }
  };

  const startEdit = (store: Store) => {
    setActionError(null);
    setConfirmDeleteId(null);
    setEditingId(store.id);
    setName(store.name);
    setStoreType(store.store_type);
    setStoreSubtype(store.store_subtype ?? "other");
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(id);
      setConfirmDeleteId(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível excluir a loja.");
    }
  };

  const onlineStores = stores.filter((s) => s.store_type === "online");
  const supermarketStores = stores.filter(
    (s) => s.store_type === "physical" && s.store_subtype === "supermarket",
  );
  const otherPhysicalStores = stores.filter(
    (s) => s.store_type === "physical" && s.store_subtype !== "supermarket",
  );

  const renderStoreList = (title: string, items: Store[]) => (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma loja cadastrada neste grupo.</p>
      ) : (
        <ul className="divide-y rounded-md border px-3">
          {items.map((store) => (
            <li key={store.id} className="space-y-2 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{store.name}</span>
                  {store.is_default && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                      Padrão
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => startEdit(store)}>
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmDeleteId(store.id)}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
              {confirmDeleteId === store.id && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 p-2.5 text-sm">
                  <span>
                    Excluir a loja <strong>{store.name}</strong>?
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => void handleDelete(store.id)}
                    >
                      Confirmar exclusão
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Editar loja" : "Nova loja"}</CardTitle>
          <CardDescription>
            Cadastre lojas online e físicas (incluindo supermercados) para vincular às suas despesas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4 sm:grid-cols-3" noValidate>
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

            <div className="flex flex-wrap gap-2 sm:col-span-3">
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "Salvar alterações" : "Adicionar loja"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </div>
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
          Não foi possível carregar suas lojas.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Suas lojas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando lojas...
            </p>
          ) : (
            <>
              {renderStoreList("Online", onlineStores)}
              {renderStoreList("Físicas — Supermercados", supermarketStores)}
              {otherPhysicalStores.length > 0 &&
                renderStoreList("Físicas — Outras", otherPhysicalStores)}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
