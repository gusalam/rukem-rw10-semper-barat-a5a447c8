import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ExportColumn {
  key: string;
  header: string;
  format?: (value: any, row: any) => string;
}

interface PDFOptions {
  orientation?: 'portrait' | 'landscape';
  columnStyles?: Record<number, { cellWidth?: number | 'auto' | 'wrap' }>;
}

export const exportToPDF = (
  data: any[],
  columns: ExportColumn[],
  title: string,
  filename: string,
  options: PDFOptions = {}
) => {
  const { orientation = 'landscape', columnStyles } = options;
  const doc = new jsPDF({ orientation });
  
  // Title
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  
  // Date
  doc.setFontSize(10);
  doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 14, 28);
  
  // Table
  const headers = columns.map(col => col.header);
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      return col.format ? col.format(value, row) : (value ?? '-');
    })
  );
  
  // Auto-generate column styles if not provided
  const defaultColumnStyles: Record<number, { cellWidth: number | 'auto' | 'wrap' }> = {};
  columns.forEach((col, index) => {
    // Set narrower widths for specific column types
    if (col.key === 'no' || col.key === 'rt' || col.key === 'rw') {
      defaultColumnStyles[index] = { cellWidth: 12 };
    } else if (col.key === 'status' || col.key === 'jenis_kelamin' || col.key === 'agama') {
      defaultColumnStyles[index] = { cellWidth: 20 };
    } else if (col.key === 'nik' || col.key === 'no_kk' || col.key === 'no_hp') {
      defaultColumnStyles[index] = { cellWidth: 32 };
    }
  });
  
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 35,
    styles: { 
      fontSize: 7,
      cellPadding: 2,
      overflow: 'linebreak',
    },
    headStyles: { 
      fillColor: [59, 130, 246],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: columnStyles || defaultColumnStyles,
    tableWidth: 'auto',
    margin: { left: 10, right: 10 },
  });
  
  doc.save(`${filename}.pdf`);
};

export const exportToExcel = (
  data: any[],
  columns: ExportColumn[],
  sheetName: string,
  filename: string
) => {
  const rows = data.map(row => {
    const obj: Record<string, any> = {};
    columns.forEach(col => {
      const value = row[col.key];
      obj[col.header] = col.format ? col.format(value, row) : (value ?? '-');
    });
    return obj;
  });
  
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
