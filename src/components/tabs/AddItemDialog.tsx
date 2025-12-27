import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Package, Scissors, PenLine } from "lucide-react";
import type { Product } from "@/types/tabs";
import type { Tables } from "@/integrations/supabase/types";

type Service = Tables<"services">;
type Professional = Tables<"professionals">;

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (item: {
    name: string;
    unit_price: number;
    quantity: number;
    item_type: 'product' | 'service' | 'custom';
    product_id?: string;
    service_id?: string;
    professional_id?: string;
    description?: string;
  }) => Promise<void>;
  products: Product[];
  services: Service[];
  professionals: Professional[];
  loading?: boolean;
}

export function AddItemDialog({
  open,
  onOpenChange,
  onAddItem,
  products,
  services,
  professionals,
  loading = false,
}: AddItemDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("products");
  const [quantity, setQuantity] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<string>("");
  
  // Custom item
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customDescription, setCustomDescription] = useState("");

  const [searchProduct, setSearchProduct] = useState("");
  const [searchService, setSearchService] = useState("");

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchService.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleAddProduct = async () => {
    if (!selectedProduct) return;
    await onAddItem({
      name: selectedProduct.name,
      unit_price: selectedProduct.price,
      quantity,
      item_type: "product",
      product_id: selectedProduct.id,
      professional_id: selectedProfessional || undefined,
    });
    resetForm();
  };

  const handleAddService = async () => {
    if (!selectedService) return;
    await onAddItem({
      name: selectedService.name,
      unit_price: selectedService.price,
      quantity,
      item_type: "service",
      service_id: selectedService.id,
      professional_id: selectedProfessional || undefined,
    });
    resetForm();
  };

  const handleAddCustom = async () => {
    if (!customName || !customPrice) return;
    await onAddItem({
      name: customName,
      unit_price: parseFloat(customPrice),
      quantity,
      item_type: "custom",
      professional_id: selectedProfessional || undefined,
      description: customDescription || undefined,
    });
    resetForm();
  };

  const resetForm = () => {
    setQuantity(1);
    setSelectedProduct(null);
    setSelectedService(null);
    setSelectedProfessional("");
    setCustomName("");
    setCustomPrice("");
    setCustomDescription("");
    setSearchProduct("");
    setSearchService("");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
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
                filteredProducts.map(product => (
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
                    {product.category && (
                      <span className="text-xs text-muted-foreground">{product.category}</span>
                    )}
                  </button>
                ))
              )}
            </ScrollArea>
            {selectedProduct && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{selectedProduct.name}</span>
                  <span>{formatCurrency(selectedProduct.price * quantity)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Qtd:</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
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
                filteredServices.map(service => (
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
                ))
              )}
            </ScrollArea>
            {selectedService && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{selectedService.name}</span>
                  <span>{formatCurrency(selectedService.price * quantity)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Qtd:</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-20"
                  />
                </div>
                <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                  <SelectTrigger>
                    <SelectValue placeholder="Profissional (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {professionals.map(prof => (
                      <SelectItem key={prof.id} value={prof.id}>{prof.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    type="number"
                    step="0.01"
                    min={0}
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
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
                    <span>{formatCurrency(parseFloat(customPrice) * quantity)}</span>
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
  );
}
