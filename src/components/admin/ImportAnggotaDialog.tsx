import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { z } from 'zod';

const REQUIRED_COLUMNS = [
  'nama_lengkap',
  'nik',
  'no_kk',
  'jenis_kelamin',
  'tempat_lahir',
  'tanggal_lahir',
  'agama',
  'status_perkawinan',
  'pekerjaan',
  'hubungan_kk',
  'alamat',
  'rt',
  'rw',
  'kelurahan',
  'kecamatan',
  'kabupaten_kota',
  'provinsi',
  'no_hp',
];

// Kolom opsional dengan default value
const OPTIONAL_COLUMNS = ['status'];

const COLUMN_LABELS: Record<string, string> = {
  nama_lengkap: 'Nama Lengkap',
  nik: 'NIK',
  no_kk: 'Nomor KK',
  jenis_kelamin: 'Jenis Kelamin (L/P)',
  tempat_lahir: 'Tempat Lahir',
  tanggal_lahir: 'Tanggal Lahir (YYYY-MM-DD)',
  agama: 'Agama',
  status_perkawinan: 'Status Perkawinan',
  pekerjaan: 'Pekerjaan',
  hubungan_kk: 'Status dalam KK',
  alamat: 'Alamat Lengkap',
  rt: 'RT',
  rw: 'RW',
  kelurahan: 'Kelurahan/Desa',
  kecamatan: 'Kecamatan',
  kabupaten_kota: 'Kabupaten/Kota',
  provinsi: 'Provinsi',
  no_hp: 'No. HP',
  status: 'Status Anggota (aktif/nonaktif/meninggal)',
};

const VALID_STATUS_VALUES = ['aktif', 'nonaktif', 'meninggal'];

const rowSchema = z.object({
  nama_lengkap: z.string().min(3, 'Nama minimal 3 karakter'),
  nik: z.string().length(16, 'NIK harus 16 digit'),
  no_kk: z.string().length(16, 'No KK harus 16 digit'),
  jenis_kelamin: z.enum(['L', 'P'], { errorMap: () => ({ message: 'Jenis kelamin harus L atau P' }) }),
  tempat_lahir: z.string().min(2, 'Tempat lahir wajib diisi'),
  tanggal_lahir: z.string().min(1, 'Tanggal lahir wajib diisi'),
  agama: z.string().min(1, 'Agama wajib diisi'),
  status_perkawinan: z.string().min(1, 'Status perkawinan wajib diisi'),
  pekerjaan: z.string().min(2, 'Pekerjaan wajib diisi'),
  hubungan_kk: z.string().min(1, 'Status dalam KK wajib diisi'),
  alamat: z.string().min(5, 'Alamat wajib diisi'),
  rt: z.string().min(1, 'RT wajib diisi'),
  rw: z.string().min(1, 'RW wajib diisi'),
  kelurahan: z.string().min(2, 'Kelurahan wajib diisi'),
  kecamatan: z.string().min(2, 'Kecamatan wajib diisi'),
  kabupaten_kota: z.string().min(2, 'Kabupaten/Kota wajib diisi'),
  provinsi: z.string().min(2, 'Provinsi wajib diisi'),
  no_hp: z.string().min(10, 'No HP minimal 10 digit'),
});

interface ParsedRow {
  data: Record<string, string>;
  errors: string[];
  rowNumber: number;
}

interface ImportAnggotaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportAnggotaDialog({ open, onOpenChange, onSuccess }: ImportAnggotaDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const { toast } = useToast();

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setStep('upload');
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  const downloadTemplate = () => {
    // Gabungkan kolom required + optional untuk template
    const allColumns = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
    
    const ws = XLSX.utils.aoa_to_sheet([
      allColumns.map(col => COLUMN_LABELS[col]),
      allColumns.map(col => {
        switch (col) {
          case 'nama_lengkap': return 'John Doe';
          case 'nik': return '3201234567890123';
          case 'no_kk': return '3201234567890001';
          case 'jenis_kelamin': return 'L';
          case 'tempat_lahir': return 'Jakarta';
          case 'tanggal_lahir': return '1990-01-15';
          case 'agama': return 'Islam';
          case 'status_perkawinan': return 'Kawin';
          case 'pekerjaan': return 'Wiraswasta';
          case 'hubungan_kk': return 'Kepala Keluarga';
          case 'alamat': return 'Jl. Contoh No. 123';
          case 'rt': return '001';
          case 'rw': return '002';
          case 'kelurahan': return 'Kelurahan Contoh';
          case 'kecamatan': return 'Kecamatan Contoh';
          case 'kabupaten_kota': return 'Kota Contoh';
          case 'provinsi': return 'Jawa Barat';
          case 'no_hp': return '081234567890';
          case 'status': return 'aktif'; // Default value untuk template
          default: return '';
        }
      }),
    ]);

    // Set column widths
    ws['!cols'] = allColumns.map(() => ({ wch: 25 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'template_import_anggota.xlsx');
  };

  const parseFile = useCallback(async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { raw: false });

      if (jsonData.length === 0) {
        toast({
          variant: 'destructive',
          title: 'File Kosong',
          description: 'File tidak memiliki data untuk diimport',
        });
        return;
      }

      // Map header names to column keys
      const headerMap: Record<string, string> = {};
      Object.entries(COLUMN_LABELS).forEach(([key, label]) => {
        headerMap[label.toLowerCase()] = key;
        headerMap[key.toLowerCase()] = key;
      });

      const parsed: ParsedRow[] = jsonData.map((row, index) => {
        const normalizedRow: Record<string, string> = {};
        const errors: string[] = [];

        // Normalize keys
        Object.entries(row).forEach(([key, value]) => {
          const normalizedKey = headerMap[key.toLowerCase().trim()];
          if (normalizedKey) {
            normalizedRow[normalizedKey] = String(value || '').trim();
          }
        });

        // Check for missing required columns
        REQUIRED_COLUMNS.forEach(col => {
          if (!normalizedRow[col]) {
            errors.push(`${COLUMN_LABELS[col]} kosong`);
          }
        });

        // Handle status column - default ke 'aktif' jika kosong/null/tidak valid
        if (!normalizedRow.status || !VALID_STATUS_VALUES.includes(normalizedRow.status.toLowerCase())) {
          normalizedRow.status = 'aktif';
        } else {
          normalizedRow.status = normalizedRow.status.toLowerCase();
        }

        // Validate with zod if all fields present
        if (errors.length === 0) {
          const validation = rowSchema.safeParse(normalizedRow);
          if (!validation.success) {
            validation.error.errors.forEach(err => {
              errors.push(err.message);
            });
          }
        }

        return {
          data: normalizedRow,
          errors,
          rowNumber: index + 2, // +2 for header row and 1-indexed
        };
      });

      setParsedData(parsed);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        variant: 'destructive',
        title: 'Gagal Membaca File',
        description: 'Pastikan file adalah Excel (.xlsx, .xls) atau CSV yang valid',
      });
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const validRows = parsedData.filter(row => row.errors.length === 0);
  const invalidRows = parsedData.filter(row => row.errors.length > 0);

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Tidak Ada Data Valid',
        description: 'Perbaiki error pada data sebelum import',
      });
      return;
    }

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const row of validRows) {
      try {
        const { error } = await supabase.from('anggota').insert([row.data as any]);
        if (error) {
          errorCount++;
          if (error.message.includes('duplicate key') && error.message.includes('nik')) {
            errors.push(`Baris ${row.rowNumber}: NIK ${row.data.nik} sudah terdaftar`);
          } else if (error.message.includes('sudah memiliki Kepala Keluarga')) {
            errors.push(`Baris ${row.rowNumber}: ${error.message}`);
          } else {
            errors.push(`Baris ${row.rowNumber}: ${error.message}`);
          }
        } else {
          successCount++;
        }
      } catch (err: any) {
        errorCount++;
        errors.push(`Baris ${row.rowNumber}: ${err.message}`);
      }
    }

    setImporting(false);

    if (successCount > 0) {
      toast({
        title: 'Import Selesai',
        description: `${successCount} data berhasil diimport${errorCount > 0 ? `, ${errorCount} gagal` : ''}`,
      });
      onSuccess();
      handleClose(false);
    } else {
      toast({
        variant: 'destructive',
        title: 'Import Gagal',
        description: errors.slice(0, 3).join('; '),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Data Anggota</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <div className="space-y-2">
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-primary hover:underline">Pilih file Excel/CSV</span>
                  <span className="text-muted-foreground"> atau drag & drop</span>
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">
                  Format: .xlsx, .xls, .csv (maks 10MB)
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium text-sm">Unduh Template</p>
                <p className="text-xs text-muted-foreground">
                  Gunakan template untuk memastikan format data benar
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Template Excel
              </Button>
            </div>

            <div className="text-sm space-y-3">
              <div>
                <p className="font-medium mb-2">Kolom Wajib:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-xs text-muted-foreground">
                  {REQUIRED_COLUMNS.map(col => (
                    <span key={col}>• {COLUMN_LABELS[col]}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-medium mb-2">Kolom Opsional:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-xs text-muted-foreground">
                  {OPTIONAL_COLUMNS.map(col => (
                    <span key={col}>• {COLUMN_LABELS[col]} (default: aktif)</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-success" />
                {validRows.length} Valid
              </Badge>
              {invalidRows.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {invalidRows.length} Error
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                File: {file?.name}
              </span>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Baris</TableHead>
                    <TableHead className="w-20">Validasi</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIK</TableHead>
                    <TableHead>No. KK</TableHead>
                    <TableHead>Hubungan KK</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((row, idx) => (
                    <TableRow key={idx} className={row.errors.length > 0 ? 'bg-destructive/5' : ''}>
                      <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                      <TableCell>
                        {row.errors.length === 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.data.nama_lengkap || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{row.data.nik || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{row.data.no_kk || '-'}</TableCell>
                      <TableCell>{row.data.hubungan_kk || '-'}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          row.data.status === 'aktif' && "bg-success/10 text-success",
                          row.data.status === 'nonaktif' && "bg-muted text-muted-foreground",
                          row.data.status === 'meninggal' && "bg-destructive/10 text-destructive"
                        )}>
                          {row.data.status || 'aktif'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-xs truncate">
                        {row.errors.join(', ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Pilih File Lain
              </Button>
              <Button onClick={handleImport} disabled={importing || validRows.length === 0}>
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Import {validRows.length} Data
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}