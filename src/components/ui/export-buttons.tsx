import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText } from 'lucide-react';

interface ExportButtonsProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
  disabled?: boolean;
}

export function ExportButtons({ onExportPDF, onExportExcel, disabled }: ExportButtonsProps) {
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
