import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { 
  Plus, Trash2, User, Clock, Package, Scissors, PenLine, 
  CreditCard, Receipt, ArrowLeft, Minus, Undo2, Tag, AlertCircle
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TabWithDetails, TabItem, PaymentMethod } from "@/types/tabs";
import { ManualDiscountDialog } from "./ManualDiscountDialog";

interface TabDetailsCardProps {
  tab: TabWithDetails;
  items: TabItem[];
  establishmentId: string;
  discountPinThreshold: number;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => Promise<void>;
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void>;
  onCheckout: () => void;
  onBack: () => void;
  onCancel: () => void;
  onUndoOpening?: () => Promise<void> | void;
  onRecalculate: () => Promise<void>;
  onDiscountChanged?: () => Promise<void> | void;
}

export function TabDetailsCard({
  tab,
  items,
  establishmentId,
  discountPinThreshold,
  onAddItem,
  onRemoveItem,
  onUpdateQuantity,
  onCheckout,
  onBack,
  onCancel,
  onUndoOpening,
  onRecalculate,
  onDiscountChanged,
}: TabDetailsCardProps) {
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmUndoOpen, setConfirmUndoOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);

  // Eligibility for "Desfazer Abertura": tab created < 5 min ago AND no items.
  const ageMs = Date.now() - new Date(tab.opened_at).getTime();
  const canUndo =
    !!onUndoOpening &&
    tab.status === "open" &&
    ageMs <= 5 * 60 * 1000 &&
    items.length === 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case "product": return <Package className="h-4 w-4" />;
      case "service": return <Scissors className="h-4 w-4" />;
      default: return <PenLine className="h-4 w-4" />;
    }
  };

  const getItemTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      product: "Produto",
      service: "Serviço",
      custom: "Avulso",
    };
    return <Badge variant="outline" className="text-xs">{labels[type] || type}</Badge>;
  };

  // Separate items by type
  const productItems = items.filter(item => item.item_type === 'product');
  const serviceItems = items.filter(item => item.item_type === 'service');
  const customItems = items.filter(item => item.item_type === 'custom');

  const productsSubtotal = productItems.reduce((acc, item) => acc + Number(item.total_price), 0);
  const servicesSubtotal = serviceItems.reduce((acc, item) => acc + Number(item.total_price), 0);
  const customSubtotal = customItems.reduce((acc, item) => acc + Number(item.total_price), 0);

  const subtotal = items.reduce((acc, item) => acc + Number(item.total_price), 0);
  const discount = Number(tab.discount_amount) || 0;
  const total = Math.max(0, subtotal - discount);

  const renderItemGroup = (groupItems: TabItem[], title: string, icon: React.ReactNode) => {
    if (groupItems.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          <span>{title}</span>
        </div>
        {groupItems.map((item) => (
          <div key={item.id} className="flex items-start justify-between p-3 bg-muted/30 rounded-lg ml-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{item.name}</span>
                {(item as any).original_unit_price != null && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-[10px] gap-1 border-amber-500 text-amber-700 dark:text-amber-400">
                          <AlertCircle className="h-3 w-3" />
                          Preço alterado
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs">
                          <div>Tabela: {formatCurrency(Number((item as any).original_unit_price))}</div>
                          <div>Aplicado: {formatCurrency(item.unit_price)}</div>
                          {(item as any).price_override_reason && (
                            <div className="italic mt-1 max-w-[200px]">{(item as any).price_override_reason}</div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {formatCurrency(item.unit_price)} x {item.quantity} = {formatCurrency(item.total_price)}
              </div>
              {item.description && (
                <div className="text-xs text-muted-foreground italic mt-1">
                  {item.description}
                </div>
              )}
            </div>
            {tab.status === "open" && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                    disabled={item.quantity <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm">{item.quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => onRemoveItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Badge variant={tab.status === "open" ? "default" : "secondary"}>
          {tab.status === "open" ? "Aberta" : tab.status === "closed" ? "Fechada" : "Cancelada"}
        </Badge>
      </div>

      {/* Client Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            {tab.client_name}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Aberta em {format(parseISO(tab.opened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
          {tab.professionals?.name && (
            <div className="text-sm text-muted-foreground mt-1">
              Profissional: {tab.professionals.name}
            </div>
          )}
          {tab.notes && (
            <div className="text-sm text-muted-foreground mt-1 italic">
              {tab.notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Itens da Comanda</CardTitle>
            {tab.status === "open" && (
              <Button size="sm" onClick={onAddItem}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum item na comanda</p>
              {tab.status === "open" && (
                <Button variant="outline" size="sm" className="mt-2" onClick={onAddItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar primeiro item
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-4">
                {renderItemGroup(serviceItems, "Serviços", <Scissors className="h-4 w-4" />)}
                {renderItemGroup(productItems, "Produtos", <Package className="h-4 w-4" />)}
                {renderItemGroup(customItems, "Itens Avulsos", <PenLine className="h-4 w-4" />)}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-2">
            {servicesSubtotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Scissors className="h-3 w-3" />
                  Serviços
                </span>
                <span>{formatCurrency(servicesSubtotal)}</span>
              </div>
            )}
            {productsSubtotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Package className="h-3 w-3" />
                  Produtos
                </span>
                <span>{formatCurrency(productsSubtotal)}</span>
              </div>
            )}
            {customSubtotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <PenLine className="h-3 w-3" />
                  Avulsos
                </span>
                <span>{formatCurrency(customSubtotal)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-sm font-medium">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>
                  Desconto
                  {(tab as any).discount_reduces_commission && (
                    <span className="text-[10px] ml-1 text-muted-foreground">
                      (abate comissão)
                    </span>
                  )}
                </span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}
            {tab.status === "open" && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground hover:text-foreground"
                onClick={() => setDiscountOpen(true)}
              >
                <Tag className="h-4 w-4 mr-2" />
                {discount > 0 ? "Editar desconto manual" : "Aplicar desconto manual"}
              </Button>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {establishmentId && (
        <ManualDiscountDialog
          open={discountOpen}
          onOpenChange={setDiscountOpen}
          establishmentId={establishmentId}
          tabId={tab.id}
          subtotal={subtotal}
          currentDiscount={discount}
          currentReducesCommission={(tab as any).discount_reduces_commission === true}
          pinThresholdPercent={discountPinThreshold}
          onApplied={async () => {
            if (onDiscountChanged) await onDiscountChanged();
          }}
        />
      )}

      {/* Actions */}
      {tab.status === "open" && (
        <div className="flex flex-col gap-2">
          {canUndo && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setConfirmUndoOpen(true)}
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Desfazer Abertura
            </Button>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => setConfirmCancelOpen(true)}
            >
              Cancelar Comanda
            </Button>
            <Button
              className="flex-1"
              onClick={onCheckout}
              disabled={items.length === 0}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Finalizar e Cobrar
            </Button>
          </div>
        </div>
      )}

      {/* Confirm Cancel */}
      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta comanda?</AlertDialogTitle>
            <AlertDialogDescription>
              A comanda será marcada como <b>cancelada</b> e o agendamento vinculado
              também será cancelado, liberando a profissional na agenda.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmCancelOpen(false);
                onCancel();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Undo */}
      <AlertDialog open={confirmUndoOpen} onOpenChange={setConfirmUndoOpen}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer abertura da comanda?</AlertDialogTitle>
            <AlertDialogDescription>
              A comanda será <b>excluída</b> e o agendamento voltará para o status
              "confirmado" na agenda. Use esta opção quando a comanda foi aberta por
              engano (sem itens lançados, há menos de 5 minutos).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmUndoOpen(false);
                if (onUndoOpening) await onUndoOpening();
              }}
            >
              Sim, desfazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
