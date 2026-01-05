import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileSpreadsheet, FileText, Download, ChevronDown } from 'lucide-react';

interface ExportButtonsProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
  disabled?: boolean;
  // Optional: handlers for exporting all data
  onExportAllPDF?: () => void;
  onExportAllExcel?: () => void;
  loading?: boolean;
}

export function ExportButtons({ 
  onExportPDF, 
  onExportExcel, 
  disabled,
  onExportAllPDF,
  onExportAllExcel,
  loading = false,
}: ExportButtonsProps) {
  const hasAllExport = onExportAllPDF || onExportAllExcel;

  if (!hasAllExport) {
    // Simple mode: just two buttons
    return (
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onExportPDF}
          disabled={disabled}
        >
          <FileText className="h-4 w-4 mr-1" />
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onExportExcel}
          disabled={disabled}
        >
          <FileSpreadsheet className="h-4 w-4 mr-1" />
          Excel
        </Button>
      </div>
    );
  }

  // Advanced mode: dropdown with options
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || loading}>
          <Download className="h-4 w-4 mr-1" />
          {loading ? 'Mengunduh...' : 'Export'}
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background z-50">
        <DropdownMenuItem onClick={onExportPDF} disabled={loading}>
          <FileText className="h-4 w-4 mr-2" />
          PDF (Halaman Ini)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportExcel} disabled={loading}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel (Halaman Ini)
        </DropdownMenuItem>
        {onExportAllPDF && (
          <DropdownMenuItem onClick={onExportAllPDF} disabled={loading}>
            <FileText className="h-4 w-4 mr-2" />
            PDF (Semua Data)
          </DropdownMenuItem>
        )}
        {onExportAllExcel && (
          <DropdownMenuItem onClick={onExportAllExcel} disabled={loading}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel (Semua Data)
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
