import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "./SignaturePad";
import { generateCommissionReceiptPdf, ReceiptCommissionRow } from "@/lib/commissionReceiptPdf";
import { Download, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface IssueReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentName: string;
  defaultResponsibleName: string;
  professionalName: string;
  rows: ReceiptCommissionRow[];
  totalPaid: number;
}

export function IssueReceiptDialog({
  open,
  onOpenChange,
  establishmentName,
  defaultResponsibleName,
  professionalName,
  rows,
  totalPaid,
}: IssueReceiptDialogProps) {
  const [responsibleName, setResponsibleName] = useState(defaultResponsibleName);
  const [employeeName, setEmployeeName] = useState(professionalName);
  const [sigResp, setSigResp] = useState<string | null>(null);
  const [sigEmp, setSigEmp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setResponsibleName(defaultResponsibleName);
      setEmployeeName(professionalName);
      setSigResp(null);
      setSigEmp(null);
    }
  }, [open, defaultResponsibleName, professionalName]);

  const canEmit = !!sigResp && !!sigEmp && responsibleName.trim() && employeeName.trim();

  const buildPdf = () => {
    return generateCommissionReceiptPdf({
      establishmentName,
      employeeName: employeeName.trim(),
      responsibleName: responsibleName.trim(),
      rows,
      totalPaid,
      signatureEmployee: sigEmp!,
      signatureResponsible: sigResp!,
    });
  };

  const fileName = () =>
    `recibo-comissoes-${employeeName.trim().replace(/\s+/g, "-").toLowerCase()}-${
      new Date().toISOString().slice(0, 10)
    }.pdf`;

  const handleDownload = async () => {
    if (!canEmit) return;
    setBusy(true);
    try {
      const doc = buildPdf();
      doc.save(fileName());
      // assinaturas descartadas
      setSigResp(null);
      setSigEmp(null);
      toast.success("Recibo gerado");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    if (!canEmit) return;
    setBusy(true);
    try {
      const doc = buildPdf();
      const blob = doc.output("blob");
      const file = new File([blob], fileName(), { type: "application/pdf" });
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "Recibo de pagamento",
          text: `Recibo de comissões de ${employeeName.trim()}`,
        });
      } else {
        // fallback: WhatsApp web com download manual
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName();
        a.click();
        URL.revokeObjectURL(url);
        const wa = `https://wa.me/?text=${encodeURIComponent(
          `Recibo de comissões de ${employeeName.trim()} — anexe o PDF baixado.`,
        )}`;
        window.open(wa, "_blank");
      }
      setSigResp(null);
      setSigEmp(null);
      onOpenChange(false);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        toast.error("Não foi possível compartilhar");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recibo de comissões — {professionalName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm rounded-md border bg-muted/30 p-3">
            <p>
              <strong>{rows.length}</strong> comissão(ões) ·{" "}
              <strong>
                {totalPaid.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome do responsável pelo salão</Label>
              <Input
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nome do funcionário(a)</Label>
              <Input
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
              />
            </div>
          </div>

          <SignaturePad
            label="Assinatura do responsável pelo salão"
            onChange={setSigResp}
          />

          <div className="border-t" />

          <SignaturePad
            label="Assinatura do funcionário(a)"
            onChange={setSigEmp}
          />

          <p className="text-[11px] text-muted-foreground">
            As imagens das assinaturas ficam apenas em memória e são descartadas após o recibo
            ser gerado. Para emitir um novo recibo será necessário assinar novamente.
          </p>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={handleShare} disabled={!canEmit || busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Share2 className="h-4 w-4 mr-1" />}
            Compartilhar
          </Button>
          <Button onClick={handleDownload} disabled={!canEmit || busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
