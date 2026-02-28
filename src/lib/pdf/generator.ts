/**
 * PDF Report Generator for tender analysis reports
 * Uses jsPDF for server-side PDF generation
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface TenderReportData {
  tender: {
    title: string;
    seapId: string;
    seapUrl: string;
    description: string | null;
    contractingAuth: string;
    contractingAuthCui: string | null;
    estimatedValue: string | null;
    currency: string;
    cpvCode: string;
    cpvDescription: string | null;
    procedureType: string;
    contractType: string | null;
    publicationDate: string | null;
    submissionDeadline: string | null;
    matchScore: number | null;
    status: string;
  };
  analysis?: {
    recommendation: string;
    aiSummary: string;
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    confidence: number;
    qualificationReqs: Record<string, unknown> | null;
    technicalSpecs: Record<string, unknown> | null;
    evaluationCriteria: Record<string, unknown> | null;
    keyDates: Record<string, unknown> | null;
  } | null;
  organizationName: string;
  generatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Nou', REVIEWING: 'In analiza', PREPARING: 'In pregatire',
  SUBMITTED: 'Depus', WON: 'Castigat', LOST: 'Pierdut',
  CANCELLED: 'Anulat', IGNORED: 'Ignorat',
};

const REC_LABELS: Record<string, string> = {
  GO: 'RECOMANDAT', CAUTION: 'CU REZERVE', NO_GO: 'NU RECOMANDAT', PENDING: 'IN ASTEPTARE',
};

export function generateTenderPdf(data: TenderReportData): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Header
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('SEAP Assistant', margin, 15);
  doc.setFontSize(10);
  doc.text('Raport Analiza Licitatie', margin, 23);
  doc.setFontSize(8);
  doc.text(`Generat: ${data.generatedAt}`, pageWidth - margin, 23, { align: 'right' });
  doc.text(`Organizatie: ${data.organizationName}`, pageWidth - margin, 15, { align: 'right' });

  y = 40;
  doc.setTextColor(0, 0, 0);

  // Title
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(data.tender.title, pageWidth - 2 * margin);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 7 + 4;

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`SEAP ID: ${data.tender.seapId}`, margin, y);
  y += 8;

  // Tender details table
  doc.setTextColor(0, 0, 0);
  doc.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, textColor: [100, 100, 100] } },
    body: [
      ['Autoritate Contractanta', data.tender.contractingAuth + (data.tender.contractingAuthCui ? ` (CUI: ${data.tender.contractingAuthCui})` : '')],
      ['Valoare Estimata', data.tender.estimatedValue ? `${data.tender.estimatedValue} ${data.tender.currency}` : 'Nedisponibila'],
      ['Cod CPV', `${data.tender.cpvCode}${data.tender.cpvDescription ? ` - ${data.tender.cpvDescription}` : ''}`],
      ['Tip Procedura', data.tender.procedureType + (data.tender.contractType ? ` / ${data.tender.contractType}` : '')],
      ['Data Publicarii', data.tender.publicationDate || 'N/A'],
      ['Termen Depunere', data.tender.submissionDeadline || 'N/A'],
      ['Status', STATUS_LABELS[data.tender.status] || data.tender.status],
      ['Scor Potrivire', data.tender.matchScore !== null ? `${data.tender.matchScore}%` : 'N/A'],
    ],
  });

  y = doc.lastAutoTable.finalY + 10;

  // Description
  if (data.tender.description) {
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Descriere', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(data.tender.description, pageWidth - 2 * margin);
    doc.text(descLines, margin, y);
    y += descLines.length * 4.5 + 8;
  }

  // AI Analysis
  if (data.analysis) {
    y = checkPageBreak(doc, y, 40);

    // Recommendation badge
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Analiza AI', margin, y);

    const recLabel = REC_LABELS[data.analysis.recommendation] || data.analysis.recommendation;
    const recColor = data.analysis.recommendation === 'GO' ? [22, 163, 74]
      : data.analysis.recommendation === 'NO_GO' ? [220, 38, 38]
      : [234, 88, 12];
    doc.setFillColor(recColor[0], recColor[1], recColor[2]);
    doc.roundedRect(pageWidth - margin - 40, y - 5, 40, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(recLabel, pageWidth - margin - 20, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    y += 8;

    // Confidence
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Incredere: ${Math.round(data.analysis.confidence * 100)}%`, margin, y);
    y += 6;

    // Summary
    if (data.analysis.aiSummary) {
      const summaryLines = doc.splitTextToSize(data.analysis.aiSummary, pageWidth - 2 * margin);
      doc.text(summaryLines, margin, y);
      y += summaryLines.length * 4.5 + 8;
    }

    // SWOT table
    y = checkPageBreak(doc, y, 50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Analiza SWOT', margin, y);
    y += 6;

    const swotData = [
      ['Puncte Forte', data.analysis.strengths.map((s, i) => `${i + 1}. ${s}`).join('\n') || '-'],
      ['Puncte Slabe', data.analysis.weaknesses.map((s, i) => `${i + 1}. ${s}`).join('\n') || '-'],
      ['Oportunitati', data.analysis.opportunities.map((s, i) => `${i + 1}. ${s}`).join('\n') || '-'],
      ['Amenintari', data.analysis.threats.map((s, i) => `${i + 1}. ${s}`).join('\n') || '-'],
    ];

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 35, halign: 'center', valign: 'middle' },
      },
      body: swotData,
      didParseCell: (hookData: { section: string; column: { index: number }; cell: { styles: { fillColor: number[]; textColor: number[] } } }) => {
        if (hookData.section === 'body' && hookData.column.index === 0) {
          const colors = [[220, 252, 231], [254, 226, 226], [219, 234, 254], [255, 237, 213]];
          const textColors = [[22, 101, 52], [153, 27, 27], [30, 64, 175], [154, 52, 18]];
          const row = (hookData as unknown as { row: { index: number } }).row.index;
          hookData.cell.styles.fillColor = colors[row];
          hookData.cell.styles.textColor = textColors[row];
        }
      },
    });

    y = doc.lastAutoTable.finalY + 10;

    // Qualification requirements
    if (data.analysis.qualificationReqs) {
      y = checkPageBreak(doc, y, 30);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Cerinte de Calificare', margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      const reqs = data.analysis.qualificationReqs;
      const reqLines = Object.entries(reqs)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`);

      for (const line of reqLines) {
        const wrapped = doc.splitTextToSize(`- ${line}`, pageWidth - 2 * margin);
        y = checkPageBreak(doc, y, wrapped.length * 4.5);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 4.5 + 2;
      }
      y += 4;
    }
  }

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Pagina ${i} / ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    doc.text('SEAP Assistant - Raport generat automat', margin, doc.internal.pageSize.getHeight() - 8);
  }

  // Return as Buffer
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

function checkPageBreak(doc: jsPDF, currentY: number, neededSpace: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + neededSpace > pageHeight - 20) {
    doc.addPage();
    return 15;
  }
  return currentY;
}
