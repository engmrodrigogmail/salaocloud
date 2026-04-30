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
import { Loader2, Plus, Trash2, CreditCard, Check, AlertCircle, Tag, X, Percent, DollarSign, Pencil } from "lucide-react";
import type { TabWithDetails, TabItem, PaymentMethod, TabPayment } from "@/types/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ManualDiscountDialog } from "./ManualDiscountDialog";

export interface CouponInfo {
  discount: number;
  calculateCommissionAfterDiscount: boolean;
  discountTarget: string;
  applicableServiceIds: string[];
  applicableProductIds: string[];
}

export interface CommissionDiscountFlags {
  commission_discount_on_manual: boolean;
  commission_discount_on_coupon: boolean;
  commission_discount_on_loyalty: boolean;
}

type Policy = 'always' | 'never' | 'ask';

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: TabWithDetails | null;
  items: TabItem[];
  paymentMethods: PaymentMethod[];
  onConfirm: (payments: Omit<TabPayment, 'id' | 'tab_id' | 'created_at'>[], couponInfo?: CouponInfo, flags?: CommissionDiscountFlags) => Promise<void>;
  loading?: boolean;
  establishmentId?: string;
  discountPinThreshold?: number;
  onTabRefresh?: () => Promise<void> | void;
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

interface ValidatedCoupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  discount_target: string;
  applicable_service_ids: string[];
  applicable_product_ids: string[];
  calculate_commission_after_discount: boolean;
  min_purchase_value: number | null;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  tab,
  items,
  paymentMethods,
  onConfirm,
  loading = false,
  establishmentId,
  discountPinThreshold = 10,
  onTabRefresh,
}: CheckoutDialogProps) {
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [installments, setInstallments] = useState<number>(1);
  const [manualDiscountOpen, setManualDiscountOpen] = useState(false);
  
  // Coupon states
  const [couponCode, setCouponCode] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<ValidatedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Commission discount policies (from establishment) + per-checkout flags
  const [policyManual, setPolicyManual] = useState<Policy>('ask');
  const [policyCoupon, setPolicyCoupon] = useState<Policy>('ask');
  const [policyLoyalty, setPolicyLoyalty] = useState<Policy>('ask');
  const [flagManual, setFlagManual] = useState<boolean>(false);
  const [flagCoupon, setFlagCoupon] = useState<boolean>(false);
  const [flagLoyalty, setFlagLoyalty] = useState<boolean>(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const subtotal = items.reduce((acc, item) => acc + Number(item.total_price), 0);
  const existingDiscount = Number(tab?.discount_amount) || 0;
  
  // Calculate coupon discount based on target
  const calculateCouponDiscount = () => {
    if (!appliedCoupon) return 0;
    
    let applicableAmount = 0;
    
    if (appliedCoupon.discount_target === "total") {
      // Apply to entire tab
      applicableAmount = subtotal - existingDiscount;
    } else if (appliedCoupon.discount_target === "services") {
      // Apply only to services (optionally filtered by specific IDs)
      const serviceItems = items.filter(item => item.item_type === "service");
      if (appliedCoupon.applicable_service_ids.length > 0) {
        applicableAmount = serviceItems
          .filter(item => item.service_id && appliedCoupon.applicable_service_ids.includes(item.service_id))
          .reduce((acc, item) => acc + Number(item.total_price), 0);
      } else {
        applicableAmount = serviceItems.reduce((acc, item) => acc + Number(item.total_price), 0);
      }
    } else if (appliedCoupon.discount_target === "products") {
      // Apply only to products (optionally filtered by specific IDs)
      const productItems = items.filter(item => item.item_type === "product");
      if (appliedCoupon.applicable_product_ids.length > 0) {
        applicableAmount = productItems
          .filter(item => item.product_id && appliedCoupon.applicable_product_ids.includes(item.product_id))
          .reduce((acc, item) => acc + Number(item.total_price), 0);
      } else {
        applicableAmount = productItems.reduce((acc, item) => acc + Number(item.total_price), 0);
      }
    }
    
    if (appliedCoupon.discount_type === "percentage") {
      return applicableAmount * (appliedCoupon.discount_value / 100);
    } else {
      return Math.min(appliedCoupon.discount_value, applicableAmount);
    }
  };
  
  const couponDiscount = calculateCouponDiscount();
  
  const totalDiscount = existingDiscount + couponDiscount;
  const total = Math.max(0, subtotal - totalDiscount);
  const totalPaid = payments.reduce((acc, p) => acc + p.amount + p.interest_amount, 0);
  const remaining = total - totalPaid;

  useEffect(() => {
    if (open) {
      setPayments([]);
      setSelectedMethod("");
      setPaymentAmount(total.toFixed(2));
      setInstallments(1);
      setCouponCode("");
      setAppliedCoupon(null);
      setCouponError(null);
    }
  }, [open]);

  useEffect(() => {
    if (open && payments.length === 0) {
      setPaymentAmount(total.toFixed(2));
    }
  }, [total, open, payments.length]);

  // Fetch establishment commission policies + initialize per-checkout flags from tab
  useEffect(() => {
    if (!open || !establishmentId) return;
    (async () => {
      const { data } = await supabase
        .from("establishments")
        .select("commission_discount_policy_manual, commission_discount_policy_coupon, commission_discount_policy_loyalty")
        .eq("id", establishmentId)
        .maybeSingle();
      const pm = ((data as any)?.commission_discount_policy_manual ?? 'ask') as Policy;
      const pc = ((data as any)?.commission_discount_policy_coupon ?? 'ask') as Policy;
      const pl = ((data as any)?.commission_discount_policy_loyalty ?? 'ask') as Policy;
      setPolicyManual(pm);
      setPolicyCoupon(pc);
      setPolicyLoyalty(pl);

      // Initial flag values: 'always' => true, 'never' => false, 'ask' => current tab value (or false)
      const tabAny = tab as any;
      setFlagManual(pm === 'always' ? true : pm === 'never' ? false : (tabAny?.commission_discount_on_manual === true));
      setFlagCoupon(pc === 'always' ? true : pc === 'never' ? false : (tabAny?.commission_discount_on_coupon === true));
      setFlagLoyalty(pl === 'always' ? true : pl === 'never' ? false : (tabAny?.commission_discount_on_loyalty === true));
    })();
  }, [open, establishmentId, tab?.id]);

  const validateCoupon = async () => {
    if (!couponCode.trim() || !establishmentId) return;
    
    setValidatingCoupon(true);
    setCouponError(null);

    try {
      const { data: coupon, error } = await supabase
        .from("discount_coupons")
        .select("*")
        .eq("establishment_id", establishmentId)
        .eq("code", couponCode.toUpperCase())
        .eq("is_active", true)
        .single();

      if (error || !coupon) {
        setCouponError("Cupom não encontrado ou inativo");
        setValidatingCoupon(false);
        return;
      }

      // Check validity dates
      const now = new Date();
      if (coupon.valid_from && new Date(coupon.valid_from) > now) {
        setCouponError("Este cupom ainda não está válido");
        setValidatingCoupon(false);
        return;
      }
      if (coupon.valid_until && new Date(coupon.valid_until) < now) {
        setCouponError("Este cupom expirou");
        setValidatingCoupon(false);
        return;
      }

      // Check max uses
      if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
        setCouponError("Este cupom atingiu o limite de usos");
        setValidatingCoupon(false);
        return;
      }

      // Check minimum purchase
      const subtotalAfterDiscount = subtotal - existingDiscount;
      if (coupon.min_purchase_value && subtotalAfterDiscount < coupon.min_purchase_value) {
        setCouponError(`Valor mínimo: ${formatCurrency(coupon.min_purchase_value)}`);
        setValidatingCoupon(false);
        return;
      }

      setAppliedCoupon({
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_target: coupon.discount_target || "total",
        applicable_service_ids: coupon.applicable_service_ids || [],
        applicable_product_ids: coupon.applicable_product_ids || [],
        calculate_commission_after_discount: coupon.calculate_commission_after_discount ?? true,
        min_purchase_value: coupon.min_purchase_value,
      });
      toast.success("Cupom aplicado com sucesso!");
    } catch (err) {
      setCouponError("Erro ao validar cupom");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  };

  const handleAddPayment = () => {
    const method = paymentMethods.find(m => m.id === selectedMethod);
    if (!method || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    let interestAmount = 0;
    if (method.has_interest && installments > 1) {
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
    // Ensure tab total is fresh before validation in close_tab_atomic
    if (onTabRefresh) await onTabRefresh();

    const paymentData = payments.map(p => ({
      payment_method_id: p.payment_method_id,
      payment_method_name: p.payment_method_name,
      amount: p.amount,
      installments: p.installments,
      has_interest: p.has_interest,
      interest_amount: p.interest_amount,
      notes: null,
    }));

    // Coupon usage is now recorded atomically inside close_tab_atomic RPC
    // (uses INSERT ... ON CONFLICT (coupon_id, tab_id) DO NOTHING via the new tab_id column).

    const couponInfo: CouponInfo | undefined = appliedCoupon ? {
      discount: couponDiscount,
      calculateCommissionAfterDiscount: appliedCoupon.calculate_commission_after_discount,
      discountTarget: appliedCoupon.discount_target,
      applicableServiceIds: appliedCoupon.applicable_service_ids,
      applicableProductIds: appliedCoupon.applicable_product_ids,
    } : undefined;

    const flags: CommissionDiscountFlags = {
      commission_discount_on_manual: flagManual,
      commission_discount_on_coupon: flagCoupon,
      commission_discount_on_loyalty: flagLoyalty,
    };

    await onConfirm(paymentData, couponInfo, flags);
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
            {/* Coupon Section */}
            <Card>
              <CardContent className="pt-4">
                <Label className="text-sm font-medium mb-2 block">Cupom de Desconto</Label>
                {appliedCoupon ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <Check className="h-4 w-4 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-700">
                        Cupom: {appliedCoupon.code}
                      </p>
                      <p className="text-xs text-green-600/80 flex items-center gap-1">
                        {appliedCoupon.discount_type === "percentage" ? (
                          <>
                            <Percent className="h-3 w-3" />
                            {appliedCoupon.discount_value}% de desconto
                          </>
                        ) : (
                          <>
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(appliedCoupon.discount_value)} de desconto
                          </>
                        )}
                        <span className="text-green-600/60">
                          ({appliedCoupon.discount_target === "services" ? "serviços" : appliedCoupon.discount_target === "products" ? "produtos" : "total"})
                        </span>
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={removeCoupon}
                      className="h-8 w-8 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={couponCode}
                          onChange={(e) => {
                            setCouponCode(e.target.value.toUpperCase());
                            setCouponError(null);
                          }}
                          placeholder="Código do cupom"
                          className="pl-10 uppercase"
                          disabled={validatingCoupon}
                          onKeyDown={(e) => e.key === "Enter" && validateCoupon()}
                        />
                      </div>
                      <Button
                        onClick={validateCoupon}
                        disabled={!couponCode.trim() || validatingCoupon}
                        variant="secondary"
                      >
                        {validatingCoupon ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Aplicar"
                        )}
                      </Button>
                    </div>
                    {couponError && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {couponError}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Itens ({items.length})</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {existingDiscount > 0 && (
                    <div className="flex justify-between text-green-600 items-center">
                      <span className="flex items-center gap-1">
                        Desconto manual
                        {(tab as any)?.commission_discount_on_manual && (
                          <span className="text-[10px] text-muted-foreground">(abate comissão)</span>
                        )}
                        {establishmentId && tab && (
                          <button
                            type="button"
                            onClick={() => setManualDiscountOpen(true)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Editar desconto manual"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                      <span>-{formatCurrency(existingDiscount)}</span>
                    </div>
                  )}
                  {existingDiscount === 0 && tab?.status === "open" && establishmentId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground hover:text-foreground -mx-2"
                      onClick={() => setManualDiscountOpen(true)}
                    >
                      <Tag className="h-4 w-4 mr-2" />
                      Aplicar desconto manual
                    </Button>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Cupom ({appliedCoupon?.code})</span>
                      <span>-{formatCurrency(couponDiscount)}</span>
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

            {/* Commission discount policy panel */}
            {(existingDiscount > 0 || couponDiscount > 0) && (
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <Label className="text-sm font-medium">Abater desconto da comissão?</Label>
                  <p className="text-xs text-muted-foreground">
                    Define se a comissão será calculada sobre o valor com desconto.
                  </p>
                  {existingDiscount > 0 && (
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={flagManual}
                        disabled={policyManual !== 'ask'}
                        onChange={(e) => setFlagManual(e.target.checked)}
                      />
                      <span className="flex-1">
                        Desconto manual abate comissão
                        {policyManual !== 'ask' && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            (definido pela política: {policyManual === 'always' ? 'sempre' : 'nunca'})
                          </span>
                        )}
                      </span>
                    </label>
                  )}
                  {couponDiscount > 0 && (
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={flagCoupon}
                        disabled={policyCoupon !== 'ask'}
                        onChange={(e) => setFlagCoupon(e.target.checked)}
                      />
                      <span className="flex-1">
                        Cupom abate comissão
                        {policyCoupon !== 'ask' && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            (definido pela política: {policyCoupon === 'always' ? 'sempre' : 'nunca'})
                          </span>
                        )}
                      </span>
                    </label>
                  )}
                </CardContent>
              </Card>
            )}

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

      {establishmentId && tab && (
        <ManualDiscountDialog
          open={manualDiscountOpen}
          onOpenChange={setManualDiscountOpen}
          establishmentId={establishmentId}
          tabId={tab.id}
          subtotal={subtotal}
          currentDiscount={existingDiscount}
          currentReducesCommission={(tab as any).commission_discount_on_manual === true}
          pinThresholdPercent={discountPinThreshold}
          onApplied={async () => {
            if (onTabRefresh) await onTabRefresh();
          }}
        />
      )}
    </Dialog>
  );
}
