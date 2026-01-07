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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  stock_quantity: number | null;
  price: number;
  is_active: boolean;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  editingProduct: Product | null;
  onSuccess: () => void;
}

const DEFAULT_CATEGORIES = ["Cabelo", "Unhas", "Pele", "Bebidas"];
const DEFAULT_UNITS = [
  { name: "Unidade", abbr: "un" },
  { name: "Quilograma", abbr: "kg" },
  { name: "Litro", abbr: "l" },
  { name: "Centímetro cúbico", abbr: "cc" },
];

export function ProductFormDialog({
  open,
  onOpenChange,
  establishmentId,
  editingProduct,
  onSuccess,
}: ProductFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("un");
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Custom categories and units
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [units, setUnits] = useState<{ name: string; abbr: string }[]>(DEFAULT_UNITS);
  const [newCategory, setNewCategory] = useState("");
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitAbbr, setNewUnitAbbr] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewUnit, setShowNewUnit] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCategoriesAndUnits();
    }
  }, [open, establishmentId]);

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name);
      setDescription(editingProduct.description || "");
      setCategory(editingProduct.category || "");
      setUnit(editingProduct.unit || "un");
      setPrice(String(editingProduct.price));
      setIsActive(editingProduct.is_active);
    } else {
      resetForm();
    }
  }, [editingProduct, open]);

  const fetchCategoriesAndUnits = async () => {
    try {
      const { data: catData } = await supabase
        .from("product_categories")
        .select("name")
        .eq("establishment_id", establishmentId);

      const { data: unitData } = await supabase
        .from("product_units")
        .select("name, abbreviation")
        .eq("establishment_id", establishmentId);

      const customCategories = catData?.map((c) => c.name) || [];
      const customUnits = unitData?.map((u) => ({ name: u.name, abbr: u.abbreviation })) || [];

      setCategories([...DEFAULT_CATEGORIES, ...customCategories]);
      setUnits([...DEFAULT_UNITS, ...customUnits]);
    } catch (error) {
      console.error("Error fetching categories/units:", error);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setCategory("");
    setUnit("un");
    setPrice("");
    setIsActive(true);
    setNewCategory("");
    setNewUnitName("");
    setNewUnitAbbr("");
    setShowNewCategory(false);
    setShowNewUnit(false);
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await supabase.from("product_categories").insert({
        establishment_id: establishmentId,
        name: newCategory.trim(),
      });
      setCategories([...categories, newCategory.trim()]);
      setCategory(newCategory.trim());
      setNewCategory("");
      setShowNewCategory(false);
      toast.success("Categoria adicionada!");
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error("Erro ao adicionar categoria");
    }
  };

  const handleAddUnit = async () => {
    if (!newUnitName.trim() || !newUnitAbbr.trim()) return;
    try {
      await supabase.from("product_units").insert({
        establishment_id: establishmentId,
        name: newUnitName.trim(),
        abbreviation: newUnitAbbr.trim().toLowerCase(),
      });
      setUnits([...units, { name: newUnitName.trim(), abbr: newUnitAbbr.trim().toLowerCase() }]);
      setUnit(newUnitAbbr.trim().toLowerCase());
      setNewUnitName("");
      setNewUnitAbbr("");
      setShowNewUnit(false);
      toast.success("Unidade adicionada!");
    } catch (error) {
      console.error("Error adding unit:", error);
      toast.error("Erro ao adicionar unidade");
    }
  };

  const handleSubmit = async () => {
    if (!name || !price) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const productData = {
        name,
        description: description || null,
        category: category || null,
        unit: unit || "un",
        price: parseFloat(price),
        is_active: isActive,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);
        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        const { error } = await supabase.from("products").insert({
          ...productData,
          establishment_id: establishmentId,
        });
        if (error) throw error;
        toast.success("Produto criado!");
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving product:", error);
      toast.error(error.message || "Erro ao salvar produto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingProduct ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
          <DialogDescription>
            {editingProduct
              ? "Atualize as informações do produto"
              : "Adicione um novo produto ao seu catálogo"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Produto *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Shampoo Profissional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do produto..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Categoria</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNewCategory(!showNewCategory)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nova
              </Button>
            </div>
            {showNewCategory ? (
              <div className="flex gap-2">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Nome da categoria"
                  className="flex-1"
                />
                <Button type="button" size="sm" onClick={handleAddCategory}>
                  Adicionar
                </Button>
              </div>
            ) : (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Unidade</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNewUnit(!showNewUnit)}
                className="h-6 px-2 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
              </Button>
            </div>
            {showNewUnit ? (
              <div className="space-y-2">
                <Input
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder="Nome (ex: Metro)"
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Input
                    value={newUnitAbbr}
                    onChange={(e) => setNewUnitAbbr(e.target.value)}
                    placeholder="Sigla (ex: m)"
                    className="text-sm"
                  />
                  <Button type="button" size="sm" onClick={handleAddUnit}>
                    OK
                  </Button>
                </div>
              </div>
            ) : (
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.abbr} value={u.abbr}>
                      {u.name} ({u.abbr})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Preço (R$) *</Label>
            <Input
              id="price"
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
              placeholder="0.00"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Produto Ativo</Label>
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editingProduct ? "Salvar" : "Criar Produto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
