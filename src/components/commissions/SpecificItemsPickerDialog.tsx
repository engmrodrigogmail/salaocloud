import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Item {
  id: string;
  name: string;
  category: string | null;
  category_id?: string | null;
}

interface SpecificItemsPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string;
  selectedServiceIds: string[];
  selectedProductIds: string[];
  onConfirm: (serviceIds: string[], productIds: string[]) => void;
}

export function SpecificItemsPickerDialog({
  open,
  onOpenChange,
  establishmentId,
  selectedServiceIds,
  selectedProductIds,
  onConfirm,
}: SpecificItemsPickerDialogProps) {
  const [services, setServices] = useState<Item[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [serviceCategories, setServiceCategories] = useState<{ id: string; name: string }[]>([]);
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>("all");
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>("all");

  const [chosenServices, setChosenServices] = useState<Set<string>>(new Set());
  const [chosenProducts, setChosenProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setChosenServices(new Set(selectedServiceIds));
      setChosenProducts(new Set(selectedProductIds));
      setSearch("");
      setServiceCategoryFilter("all");
      setProductCategoryFilter("all");
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [svcRes, prodRes, svcCatRes] = await Promise.all([
        supabase
          .from("services")
          .select("id, name, category_id")
          .eq("establishment_id", establishmentId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("products")
          .select("id, name, category")
          .eq("establishment_id", establishmentId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("service_categories")
          .select("id, name")
          .eq("establishment_id", establishmentId)
          .order("name"),
      ]);

      const svcCats = svcCatRes.data || [];
      setServiceCategories(svcCats);
      const catMap = new Map(svcCats.map((c) => [c.id, c.name]));

      setServices(
        (svcRes.data || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          category_id: s.category_id,
          category: s.category_id ? catMap.get(s.category_id) || null : null,
        }))
      );

      const prods = (prodRes.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category,
      }));
      setProducts(prods);
      setProductCategories(
        Array.from(new Set(prods.map((p) => p.category).filter(Boolean))) as string[]
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (serviceCategoryFilter !== "all" && s.category_id !== serviceCategoryFilter) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [services, search, serviceCategoryFilter]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (productCategoryFilter !== "all" && p.category !== productCategoryFilter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, productCategoryFilter]);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const totalSelected = chosenServices.size + chosenProducts.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar produtos e serviços</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs defaultValue="services" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="services">
                Serviços {chosenServices.size > 0 && <Badge variant="secondary" className="ml-2">{chosenServices.size}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="products">
                Produtos {chosenProducts.size > 0 && <Badge variant="secondary" className="ml-2">{chosenProducts.size}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="services" className="flex-1 overflow-hidden flex flex-col space-y-3 mt-3">
              <Select value={serviceCategoryFilter} onValueChange={setServiceCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {serviceCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <ScrollArea className="flex-1 border rounded-md">
                {loading ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">Carregando...</p>
                ) : filteredServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">Nenhum serviço encontrado</p>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredServices.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={chosenServices.has(s.id)}
                          onCheckedChange={() => toggle(chosenServices, s.id, setChosenServices)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          {s.category && (
                            <p className="text-xs text-muted-foreground truncate">{s.category}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="products" className="flex-1 overflow-hidden flex flex-col space-y-3 mt-3">
              <Select value={productCategoryFilter} onValueChange={setProductCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {productCategories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <ScrollArea className="flex-1 border rounded-md">
                {loading ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">Carregando...</p>
                ) : filteredProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">Nenhum produto encontrado</p>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredProducts.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={chosenProducts.has(p.id)}
                          onCheckedChange={() => toggle(chosenProducts, p.id, setChosenProducts)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          {p.category && (
                            <p className="text-xs text-muted-foreground truncate">{p.category}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onConfirm(Array.from(chosenServices), Array.from(chosenProducts));
              onOpenChange(false);
            }}
          >
            Confirmar {totalSelected > 0 && `(${totalSelected})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
