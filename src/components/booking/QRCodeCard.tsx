import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QrCode, Copy, Download, Check } from "lucide-react";

interface QRCodeCardProps {
  slug: string;
  establishmentName: string;
}

export function QRCodeCard({ slug, establishmentName }: QRCodeCardProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const bookingUrl = `${window.location.origin}/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `qr-code-${slug}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("QR Code baixado!");
      }, "image/png");
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          Link e QR Code de Agendamento
        </CardTitle>
        <CardDescription>
          Compartilhe este link ou imprima o QR Code para que suas clientes agendem com facilidade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Link de agendamento</Label>
          <div className="flex gap-2">
            <Input value={bookingUrl} readOnly className="font-mono text-sm" />
            <Button variant="outline" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">{copied ? "Copiado" : "Copiar"}</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 rounded-lg border bg-muted/30 p-6">
          <div ref={qrRef} className="rounded-lg bg-white p-4 shadow-sm">
            <QRCodeSVG
              value={bookingUrl}
              size={200}
              level="H"
              includeMargin={false}
            />
          </div>
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            Imprima este QR Code e disponibilize no balcão do {establishmentName} para que suas clientes agendem com facilidade.
          </p>
          <Button onClick={handleDownload} variant="default">
            <Download className="mr-2 h-4 w-4" />
            Baixar QR Code (PNG)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
