import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const exportToPDF = (title: string, columns: string[], data: any[][], filename: string) => {
  const doc = new jsPDF();
  doc.text(title, 14, 15);
  (doc as any).autoTable({
    head: [columns],
    body: data,
    startY: 20,
    theme: 'grid',
    headStyles: { fillColor: [14, 165, 233] },
  });
  doc.save(`${filename}.pdf`);
};

export const exportToExcel = (data: any[], filename: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
