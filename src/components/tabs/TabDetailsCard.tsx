import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, Trash2, User, Clock, Package, Scissors, PenLine, 
  CreditCard, Receipt, ArrowLeft, Minus
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TabWithDetails, TabItem, PaymentMethod } from "@/types/tabs";

interface TabDetailsCardProps {
  tab: TabWithDetails;
  items: TabItem[];
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => Promise<void>;
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void>;
  onCheckout: () => void;
  onBack: () => void;
  onCancel: () => void;
  onRecalculate: () => Promise<void>;
}

export function TabDetailsCard({
  tab,
  items,
  onAddItem,
  onRemoveItem,
  onUpdateQuantity,
  onCheckout,
  onBack,
  onCancel,
  onRecalculate,
}: TabDetailsCardProps) {
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

  const subtotal = items.reduce((acc, item) => acc + Number(item.total_price), 0);
  const discount = Number(tab.discount_amount) || 0;
  const total = Math.max(0, subtotal - discount);

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
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {getItemIcon(item.item_type)}
                        <span className="font-medium">{item.name}</span>
                        {getItemTypeBadge(item.item_type)}
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
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Desconto</span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {tab.status === "open" && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="destructive" 
            className="flex-1"
            onClick={onCancel}
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
      )}
    </div>
  );
}
