import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Check, X, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type CategoryKind = "service" | "product";

interface Category {
  id: string;
  name: string;
}

interface CategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  kind: CategoryKind;
  onChanged?: () => void;
}

const TABLE_BY_KIND: Record<CategoryKind, "service_categories" | "product_categories"> = {
  service: "service_categories",
  product: "product_categories",
};

const LABEL_BY_KIND: Record<CategoryKind, string> = {
  service: "serviços",
  product: "produtos",
};

export function CategoryManagerDialog({
  open,
  onOpenChange,
  establishmentId,
  kind,
  onChanged,
}: CategoryManagerDialogProps) {
  const table = TABLE_BY_KIND[kind];
  const label = LABEL_BY_KIND[kind];

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && establishmentId) {
      fetchCategories();
    }
  }, [open, establishmentId, kind]);

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select("id, name")
      .eq("establishment_id", establishmentId)
      .order("name");

    if (error) {
      toast.error("Erro ao carregar categorias");
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;

    const { error } = await supabase
      .from(table)
      .insert({ establishment_id: establishmentId, name });

    if (error) {
      if (error.code === "23505") {
        toast.error("Já existe uma categoria com esse nome");
      } else {
        toast.error(error.message || "Erro ao criar categoria");
      }
      return;
    }
    toast.success("Categoria criada!");
    setNewName("");
    await fetchCategories();
    onChanged?.();
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async () => {
    const name = editingName.trim();
    if (!name || !editingId) return;

    const { error } = await supabase
      .from(table)
      .update({ name })
      .eq("id", editingId);

    if (error) {
      if (error.code === "23505") {
        toast.error("Já existe uma categoria com esse nome");
      } else {
        toast.error(error.message || "Erro ao atualizar");
      }
      return;
    }
    toast.success("Categoria atualizada!");
    cancelEdit();
    await fetchCategories();
    onChanged?.();
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from(table).delete().eq("id", deletingId);
    if (error) {
      toast.error(error.message || "Erro ao excluir");
      setDeletingId(null);
      return;
    }
    toast.success(`Categoria removida. Os ${label} ficaram sem categoria.`);
    setDeletingId(null);
    await fetchCategories();
    onChanged?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar categorias de {label}</DialogTitle>
            <DialogDescription>
              Crie, renomeie ou exclua categorias. Excluir uma categoria não remove os {label} —
              eles apenas ficam sem categoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nova categoria</Label>
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Cabelo"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                />
                <Button onClick={handleAdd} disabled={!newName.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>

            <div className="border rounded-lg divide-y">
              {loading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Carregando...
                </div>
              ) : categories.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Nenhuma categoria cadastrada ainda.
                </div>
              ) : (
                categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2 p-3">
                    {editingId === cat.id ? (
                      <>
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveEdit();
                            } else if (e.key === "Escape") {
                              cancelEdit();
                            }
                          }}
                        />
                        <Button size="icon" variant="ghost" onClick={saveEdit}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 font-medium">{cat.name}</span>
                        <Button size="icon" variant="ghost" onClick={() => startEdit(cat)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletingId(cat.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Os {label} vinculados a esta categoria continuarão existindo, mas ficarão sem
              categoria. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
