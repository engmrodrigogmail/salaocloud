import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, CreditCard, Check, AlertCircle } from "lucide-react";
import type { TabWithDetails, TabItem, PaymentMethod, TabPayment } from "@/types/tabs";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: TabWithDetails | null;
  items: TabItem[];
  paymentMethods: PaymentMethod[];
  onConfirm: (payments: Omit<TabPayment, 'id' | 'tab_id' | 'created_at'>[]) => Promise<void>;
  loading?: boolean;
}

interface PaymentEntry {
  id: string;
  payment_method_id: string;
  payment_method_name: string;
  amount: number;
  installments: number;
  has_interest: boolean;
  interest_amount: number;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  tab,
  items,
  paymentMethods,
  onConfirm,
  loading = false,
}: CheckoutDialogProps) {
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [installments, setInstallments] = useState<number>(1);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const subtotal = items.reduce((acc, item) => acc + Number(item.total_price), 0);
  const discount = Number(tab?.discount_amount) || 0;
  const total = Math.max(0, subtotal - discount);
  const totalPaid = payments.reduce((acc, p) => acc + p.amount + p.interest_amount, 0);
  const remaining = total - totalPaid;

  useEffect(() => {
    if (open) {
      setPayments([]);
      setSelectedMethod("");
      setPaymentAmount(total.toFixed(2));
      setInstallments(1);
    }
  }, [open, total]);

  const handleAddPayment = () => {
    const method = paymentMethods.find(m => m.id === selectedMethod);
    if (!method || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    let interestAmount = 0;
    if (method.has_interest && installments > 1) {
      // Simple interest calculation
      interestAmount = amount * (method.interest_rate / 100) * installments;
    }

    const payment: PaymentEntry = {
      id: crypto.randomUUID(),
      payment_method_id: method.id,
      payment_method_name: method.name,
      amount,
      installments: method.allows_installments ? installments : 1,
      has_interest: method.has_interest && installments > 1,
      interest_amount: interestAmount,
    };

    setPayments([...payments, payment]);
    setPaymentAmount(Math.max(0, remaining - amount).toFixed(2));
    setSelectedMethod("");
    setInstallments(1);
  };

  const handleRemovePayment = (paymentId: string) => {
    setPayments(payments.filter(p => p.id !== paymentId));
  };

  const handleConfirm = async () => {
    const paymentData = payments.map(p => ({
      payment_method_id: p.payment_method_id,
      payment_method_name: p.payment_method_name,
      amount: p.amount,
      installments: p.installments,
      has_interest: p.has_interest,
      interest_amount: p.interest_amount,
      notes: null,
    }));
    await onConfirm(paymentData);
  };

  const selectedPaymentMethod = paymentMethods.find(m => m.id === selectedMethod);
  const canAddPayment = selectedMethod && paymentAmount && parseFloat(paymentAmount) > 0;
  const isFullyPaid = Math.abs(remaining) < 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Finalizar Comanda</DialogTitle>
          <DialogDescription>
            Registre os pagamentos para fechar a comanda de {tab?.client_name}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Summary */}
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Itens ({items.length})</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600">
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

            {/* Payments Added */}
            {payments.length > 0 && (
              <div className="space-y-2">
                <Label>Pagamentos Registrados</Label>
                {payments.map((payment) => (
                  <div 
                    key={payment.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{payment.payment_method_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {payment.installments > 1 && `${payment.installments}x `}
                        {formatCurrency(payment.amount)}
                        {payment.has_interest && (
                          <span className="text-amber-600 ml-1">
                            (+{formatCurrency(payment.interest_amount)} juros)
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemovePayment(payment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex justify-between p-2 bg-primary/10 rounded-lg font-medium">
                  <span>Total Pago</span>
                  <span>{formatCurrency(totalPaid)}</span>
                </div>
                {!isFullyPaid && remaining > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-amber-100 text-amber-800 rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Restam {formatCurrency(remaining)} para pagar
                  </div>
                )}
              </div>
            )}

            {/* Add Payment */}
            {!isFullyPaid && (
              <div className="space-y-3 p-4 border rounded-lg">
                <Label>Adicionar Pagamento</Label>
                
                <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a forma de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(method => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.name}
                        {method.allows_installments && " (parcelável)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedPaymentMethod && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Valor</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      {selectedPaymentMethod.allows_installments && (
                        <div className="space-y-2">
                          <Label>Parcelas</Label>
                          <Select 
                            value={installments.toString()} 
                            onValueChange={(v) => setInstallments(parseInt(v))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: selectedPaymentMethod.max_installments }, (_, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                  {i + 1}x {selectedPaymentMethod.has_interest && i > 0 ? "(com juros)" : "(sem juros)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    
                    {selectedPaymentMethod.has_interest && installments > 1 && (
                      <div className="text-sm text-amber-600">
                        Taxa de juros: {selectedPaymentMethod.interest_rate}% ao mês
                      </div>
                    )}

                    <Button 
                      onClick={handleAddPayment} 
                      disabled={!canAddPayment}
                      className="w-full"
                      variant="secondary"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Pagamento
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Success State */}
            {isFullyPaid && (
              <div className="flex items-center gap-2 p-4 bg-green-100 text-green-800 rounded-lg">
                <Check className="h-5 w-5" />
                <span className="font-medium">Pagamento completo!</span>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isFullyPaid || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Check className="h-4 w-4 mr-2" />
            Confirmar e Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
