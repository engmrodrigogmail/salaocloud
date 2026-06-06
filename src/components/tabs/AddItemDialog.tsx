import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Package, Scissors, PenLine, ShieldAlert, AlertTriangle } from "lucide-react";
import type { Product } from "@/types/tabs";
import type { Tables } from "@/integrations/supabase/types";
import { useCatalogCategories } from "@/hooks/useCatalogCategories";
import { ManagerPinDialog, logManagerOverride } from "@/components/security/ManagerPinDialog";

type Service = Tables<"services">;
type Professional = Tables<"professionals">;

export interface AddItemPayload {
  name: string;
  unit_price: number;
  quantity: number;
  item_type: 'product' | 'service' | 'custom';
  product_id?: string;
  service_id?: string;
  professional_id?: string;
  description?: string;
  /** Set when user manually changed the catalog price */
  original_unit_price?: number | null;
  price_override_by?: string | null;
  price_override_reason?: string | null;
}

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (item: AddItemPayload) => Promise<void>;
  products: Product[];
  services: Service[];
  professionals: Professional[];
  /** Matrix of professional×service pairs registered for the establishment */
  professionalServices?: Array<{ professional_id: string; service_id: string }>;
  loading?: boolean;
  /** Required to open the manager PIN dialog when overriding catalog price */
  establishmentId?: string;
  /** Pre-fill professional from the tab (e.g. tab.professional_id) */
  defaultProfessionalId?: string | null;
}

export function AddItemDialog({
  open,
  onOpenChange,
  onAddItem,
  products,
  services,
  professionals,
  professionalServices = [],
  loading = false,
  establishmentId,
  defaultProfessionalId,
}: AddItemDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("products");
  const [quantity, setQuantity] = useState("1");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<string>("");

  // Editable price for catalog items (string to allow empty/decimals)
  const [overridePrice, setOverridePrice] = useState<string>("");

  // Custom item
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customDescription, setCustomDescription] = useState("");

  const [searchProduct, setSearchProduct] = useState("");
  const [searchService, setSearchService] = useState("");

  // PIN flow
  const [pinOpen, setPinOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<AddItemPayload | null>(null);

  useEffect(() => {
    if (selectedProduct) setOverridePrice(selectedProduct.price.toString());
  }, [selectedProduct?.id]);

  useEffect(() => {
    if (selectedService) setOverridePrice(selectedService.price.toString());
  }, [selectedService?.id]);

  // Pre-fill professional when dialog opens (from tab.professional_id)
  useEffect(() => {
    if (open && defaultProfessionalId && !selectedProfessional) {
      setSelectedProfessional(defaultProfessionalId);
    }
  }, [open, defaultProfessionalId]);

  const { getServiceCategory } = useCatalogCategories(establishmentId ?? null);

  const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

  const groupAndSort = <T extends { name: string }>(
    items: T[],
    getGroup: (it: T) => string,
  ): Array<{ group: string; items: T[] }> => {
    const map = new Map<string, T[]>();
    for (const it of items) {
      const g = getGroup(it) || "Sem categoria";
      const arr = map.get(g) ?? [];
      arr.push(it);
      map.set(g, arr);
    }
    return Array.from(map.entries())
      .map(([group, list]) => ({
        group,
        items: [...list].sort((a, b) => collator.compare(a.name, b.name)),
      }))
      .sort((a, b) => {
        if (a.group === "Sem categoria" && b.group !== "Sem categoria") return 1;
        if (b.group === "Sem categoria" && a.group !== "Sem categoria") return -1;
        return collator.compare(a.group, b.group);
      });
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(searchService.toLowerCase())
  );

  const productGroups = groupAndSort(filteredProducts, (p) => p.category || "");
  const serviceGroups = groupAndSort(filteredServices, (s) =>
    getServiceCategory((s as any).category_id),
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const parsedOverride = parseFloat((overridePrice || "0").replace(",", ".")) || 0;

  const submit = async (payload: AddItemPayload) => {
    await onAddItem(payload);
    // Preserve the selected professional so consecutive items in the same
    // tab don't lose it (which was causing commissions to be skipped from
    // the 2nd item onward).
    resetForm({ keepProfessional: true });
  };

  const handleAddProduct = async () => {
    if (!selectedProduct) return;
    const catalog = selectedProduct.price;
    const isOverride = Math.abs(parsedOverride - catalog) > 0.005;
    const payload: AddItemPayload = {
      name: selectedProduct.name,
      unit_price: parsedOverride > 0 ? parsedOverride : catalog,
      quantity: parseInt(quantity) || 1,
      item_type: "product",
      product_id: selectedProduct.id,
      professional_id: selectedProfessional || undefined,
      original_unit_price: isOverride ? catalog : null,
    };
    if (isOverride) {
      setPendingPayload(payload);
      setPinOpen(true);
      return;
    }
    await submit(payload);
  };

  const isProfMissingService = (profId: string, serviceId: string) =>
    !professionalServices.some(
      (ps) => ps.professional_id === profId && ps.service_id === serviceId,
    );

  const handleAddService = async () => {
    if (!selectedService) return;
    const catalog = selectedService.price;
    const isOverride = Math.abs(parsedOverride - catalog) > 0.005;
    const payload: AddItemPayload = {
      name: selectedService.name,
      unit_price: parsedOverride > 0 ? parsedOverride : catalog,
      quantity: parseInt(quantity) || 1,
      item_type: "service",
      service_id: selectedService.id,
      professional_id: selectedProfessional || undefined,
      original_unit_price: isOverride ? catalog : null,
    };
    if (isOverride) {
      setPendingPayload(payload);
      setPinOpen(true);
      return;
    }
    if (selectedProfessional && isProfMissingService(selectedProfessional, selectedService.id)) {
      // Non-blocking warning; the user may still proceed (the toast is just informative).
      // The visual badge in the dropdown already flags the inconsistency.
      // (Final warning is also surfaced in the checkout dialog.)
      // eslint-disable-next-line no-alert
    }
    await submit(payload);
  };

  const handleAddCustom = async () => {
    if (!customName || !customPrice) return;
    await submit({
      name: customName,
      unit_price: parseFloat(customPrice) || 0,
      quantity: parseInt(quantity) || 1,
      item_type: "custom",
      professional_id: selectedProfessional || undefined,
      description: customDescription || undefined,
    });
  };

  const resetForm = (opts?: { keepProfessional?: boolean }) => {
    setQuantity("1");
    setSelectedProduct(null);
    setSelectedService(null);
    if (!opts?.keepProfessional) setSelectedProfessional("");
    setOverridePrice("");
    setCustomName("");
    setCustomPrice("");
    setCustomDescription("");
    setSearchProduct("");
    setSearchService("");
    setPendingPayload(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const renderOverrideField = (catalogPrice: number) => {
    const isOverride = Math.abs(parsedOverride - catalogPrice) > 0.005;
    return (
      <div className="space-y-1">
        <Label className="text-xs">Preço unitário</Label>
        <Input
          type="text"
          inputMode="decimal"
          value={overridePrice}
          onChange={(e) =>
            setOverridePrice(e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."))
          }
          placeholder={catalogPrice.toFixed(2)}
        />
        <div className="text-[11px] text-muted-foreground">
          Tabela: {formatCurrency(catalogPrice)}
        </div>
        {isOverride && (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Preço diferente do cadastro — exigirá PIN do gerente.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
            <DialogDescription>
              Selecione um produto, serviço ou adicione um item personalizado
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="products" className="flex items-center gap-1">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Produtos</span>
              </TabsTrigger>
              <TabsTrigger value="services" className="flex items-center gap-1">
                <Scissors className="h-4 w-4" />
                <span className="hidden sm:inline">Serviços</span>
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex items-center gap-1">
                <PenLine className="h-4 w-4" />
                <span className="hidden sm:inline">Avulso</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-4">
              <Input
                placeholder="Buscar produto..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
              />
              <ScrollArea className="h-40 border rounded-md">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    {products.length === 0 ? "Nenhum produto cadastrado" : "Nenhum produto encontrado"}
                  </div>
                ) : (
                  productGroups.map(({ group, items }) => (
                    <div key={group}>
                      <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide bg-muted/60 text-muted-foreground border-b">
                        {group}
                      </div>
                      {items.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => setSelectedProduct(product)}
                          className={`w-full text-left px-3 py-2 hover:bg-muted border-b last:border-0 ${
                            selectedProduct?.id === product.id ? "bg-primary/10" : ""
                          }`}
                        >
                          <div className="flex justify-between">
                            <span className="font-medium">{product.name}</span>
                            <span className="text-muted-foreground">{formatCurrency(product.price)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </ScrollArea>
              {selectedProduct && (
                <div className="space-y-3 p-3 bg-muted/50 rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{selectedProduct.name}</span>
                    <span>
                      {formatCurrency(parsedOverride * (parseInt(quantity) || 1))}
                    </span>
                  </div>
                  {renderOverrideField(selectedProduct.price)}
                  <div className="flex items-center gap-2">
                    <Label>Qtd:</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-20"
                    />
                  </div>
                  <Button onClick={handleAddProduct} disabled={loading} className="w-full">
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Adicionar Produto
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="services" className="space-y-4">
              <Input
                placeholder="Buscar serviço..."
                value={searchService}
                onChange={(e) => setSearchService(e.target.value)}
              />
              <ScrollArea className="h-40 border rounded-md">
                {filteredServices.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    Nenhum serviço encontrado
                  </div>
                ) : (
                  serviceGroups.map(({ group, items }) => (
                    <div key={group}>
                      <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide bg-muted/60 text-muted-foreground border-b">
                        {group}
                      </div>
                      {items.map((service) => (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => setSelectedService(service)}
                          className={`w-full text-left px-3 py-2 hover:bg-muted border-b last:border-0 ${
                            selectedService?.id === service.id ? "bg-primary/10" : ""
                          }`}
                        >
                          <div className="flex justify-between">
                            <span className="font-medium">{service.name}</span>
                            <span className="text-muted-foreground">{formatCurrency(service.price)}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{service.duration_minutes} min</span>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </ScrollArea>
              {selectedService && (
                <div className="space-y-3 p-3 bg-muted/50 rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{selectedService.name}</span>
                    <span>
                      {formatCurrency(parsedOverride * (parseInt(quantity) || 1))}
                    </span>
                  </div>
                  {renderOverrideField(selectedService.price)}
                  <div className="flex items-center gap-2">
                    <Label>Qtd:</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-20"
                    />
                  </div>
                  <SearchableSelect
                    value={selectedProfessional}
                    onValueChange={setSelectedProfessional}
                    placeholder="Profissional (opcional)"
                    searchPlaceholder="Buscar profissional..."
                    allowClear
                    clearLabel="Nenhum"
                    options={professionals.map((prof) => {
                      const missing = isProfMissingService(prof.id, selectedService.id);
                      return {
                        value: prof.id,
                        label: prof.name,
                        hint: missing ? "sem este serviço" : undefined,
                        keywords: missing ? "sem este servico" : "",
                      };
                    })}
                  />
                  {selectedProfessional && isProfMissingService(selectedProfessional, selectedService.id) && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Profissional sem este serviço cadastrado. Poderá ocorrer erros na comanda ou no cálculo das comissões.
                      </AlertDescription>
                    </Alert>
                  )}
                  <Button onClick={handleAddService} disabled={loading} className="w-full">
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Adicionar Serviço
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="custom" className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome do Item *</Label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Ex: Taxa de estacionamento"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Valor Unitário *</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={customPrice}
                      onChange={(e) =>
                        setCustomPrice(e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."))
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ""))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="Descrição adicional"
                  />
                </div>
                {customName && customPrice && (
                  <div className="p-3 bg-muted/50 rounded-md">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-medium">{customName}</span>
                      <span>
                        {formatCurrency((parseFloat(customPrice) || 0) * (parseInt(quantity) || 1))}
                      </span>
                    </div>
                    <Button onClick={handleAddCustom} disabled={loading} className="w-full">
                      {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Adicionar Item
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {establishmentId && (
        <ManagerPinDialog
          open={pinOpen}
          onOpenChange={(o) => {
            setPinOpen(o);
            if (!o) setPendingPayload(null);
          }}
          establishmentId={establishmentId}
          reason={
            pendingPayload
              ? `Alterar preço de "${pendingPayload.name}" para ${formatCurrency(
                  pendingPayload.unit_price
                )} (tabela: ${formatCurrency(pendingPayload.original_unit_price ?? 0)})`
              : "Sobrescrever preço de item"
          }
          onAuthorized={async ({ managerProfessionalId, ownerUserId, isOwner }) => {
            if (!pendingPayload) return;
            const payload: AddItemPayload = {
              ...pendingPayload,
              price_override_by: isOwner ? null : managerProfessionalId,
              price_override_reason: isOwner
                ? "Override autorizado pelo dono do salão"
                : "Override autorizado por gerente via PIN",
            };
            await submit(payload);
            await logManagerOverride({
              establishmentId,
              managerProfessionalId: isOwner ? null : managerProfessionalId,
              ownerUserId: ownerUserId ?? null,
              actionType: "item_price_override",
              targetType: "tab_item",
              oldValue: { unit_price: payload.original_unit_price },
              newValue: { unit_price: payload.unit_price, item_name: payload.name },
              reason: payload.price_override_reason ?? null,
            });
          }}
        />
      )}
    </>
  );
}
