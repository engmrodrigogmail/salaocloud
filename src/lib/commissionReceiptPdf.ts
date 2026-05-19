import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { valorPorExtensoBRL } from "@/lib/numberToWordsBR";
import { salonInlineReference } from "@/lib/salonReference";

export interface ReceiptCommissionRow {
  service_date_display: string;
  service_name: string;
  client_name: string;
  gross_value: number;
  commission_amount: number;
}

export interface ReceiptInput {
  establishmentName: string;
  employeeName: string;
  responsibleName: string;
  rows: ReceiptCommissionRow[];
  totalPaid: number;
  signatureEmployee: string; // dataURL
  signatureResponsible: string; // dataURL
  issuedAt?: Date;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function generateCommissionReceiptPdf(input: ReceiptInput): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const issuedAt = input.issuedAt ?? new Date();

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("RECIBO DE PAGAMENTO", pageW / 2, 20, { align: "center" });

  // Corpo do texto
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const salonRef = salonInlineReference(input.establishmentName);
  const valorExtenso = valorPorExtensoBRL(input.totalPaid);
  const corpo =
    `Eu, ${input.employeeName}, declaro que recebi do ${salonRef} na data de hoje a quantia ` +
    `de ${fmt(input.totalPaid)} (${valorExtenso}) referente às comissões abaixo descritas:`;
  const linhas = doc.splitTextToSize(corpo, pageW - margin * 2);
  doc.text(linhas, margin, 32);

  const startY = 32 + linhas.length * 5 + 4;

  // Tabela
  autoTable(doc, {
    startY,
    head: [["Data", "Serviço", "Cliente", "Valor bruto", "Comissão"]],
    body: input.rows.map((r) => [
      r.service_date_display,
      r.service_name,
      r.client_name,
      fmt(r.gross_value),
      fmt(r.commission_amount),
    ]),
    foot: [[
      { content: "TOTAL", colSpan: 4, styles: { halign: "right", fontStyle: "bold" } },
      { content: fmt(input.totalPaid), styles: { fontStyle: "bold" } },
    ]],
    styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [60, 60, 60], textColor: 255 },
    footStyles: { fillColor: [235, 235, 235], textColor: 20 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 40 },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 25, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // @ts-ignore
  let cursorY: number = (doc as any).lastAutoTable.finalY + 10;

  // Data e hora
  doc.setFontSize(10);
  doc.text(
    `Emitido em ${format(issuedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    margin,
    cursorY,
  );
  cursorY += 10;

  // Assinaturas - lado a lado se couber, senão empilhadas
  const sigW = 80;
  const sigH = 30;
  const colW = (pageW - margin * 2 - 10) / 2;

  // Garantir espaço; se não couber, pular para próxima página
  if (cursorY + sigH + 20 > doc.internal.pageSize.getHeight() - margin) {
    doc.addPage();
    cursorY = margin;
  }

  const drawSignatureBlock = (
    x: number,
    label: string,
    name: string,
    dataUrl: string,
  ) => {
    try {
      doc.addImage(dataUrl, "PNG", x, cursorY, sigW, sigH);
    } catch {
      // ignore image errors
    }
    const lineY = cursorY + sigH + 1;
    doc.setDrawColor(0);
    doc.line(x, lineY, x + sigW, lineY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(name, x + sigW / 2, lineY + 5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(label, x + sigW / 2, lineY + 9, { align: "center" });
  };

  const col1X = margin + (colW - sigW) / 2;
  const col2X = margin + colW + 10 + (colW - sigW) / 2;

  drawSignatureBlock(col1X, "Funcionário(a)", input.employeeName, input.signatureEmployee);
  drawSignatureBlock(col2X, "Responsável pelo salão", input.responsibleName, input.signatureResponsible);

  return doc;
}
