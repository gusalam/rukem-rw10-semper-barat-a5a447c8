import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Loader2, Wrench } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface FixStatusAnggotaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  anggotaTanpaStatus: number;
}

export function FixStatusAnggotaDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  anggotaTanpaStatus 
}: FixStatusAnggotaDialogProps) {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const { toast } = useToast();

  const handleFix = async () => {
    setProcessing(true);
    setResult(null);

    try {
      // Update semua anggota yang statusnya null/tidak valid menjadi 'aktif'
      const { data, error, count } = await supabase
        .from('anggota')
        .update({ status: 'aktif' })
        .or('status.is.null')
        .select('id');

      if (error) throw error;

      const updatedCount = data?.length || 0;
      
      setResult({ success: updatedCount, failed: 0 });
      
      toast({
        title: '✓ Perbaikan Selesai',
        description: `${updatedCount} data anggota berhasil diperbarui dengan status "aktif"`,
      });

      // Refetch data
      onSuccess();
    } catch (error: any) {
      console.error('Error fixing status:', error);
      toast({
        variant: 'destructive',
        title: 'Gagal Memperbaiki Data',
        description: error.message || 'Terjadi kesalahan saat memperbaiki data',
      });
      setResult({ success: 0, failed: anggotaTanpaStatus });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setResult(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Perbaiki Status Anggota
          </DialogTitle>
          <DialogDescription>
            Tool untuk memperbaiki data anggota yang tidak memiliki status
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!result ? (
            <>
              <Alert variant={anggotaTanpaStatus > 0 ? "destructive" : "default"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {anggotaTanpaStatus > 0 
                    ? `${anggotaTanpaStatus} anggota tanpa status` 
                    : 'Semua data sudah lengkap'}
                </AlertTitle>
                <AlertDescription>
                  {anggotaTanpaStatus > 0 
                    ? 'Data ini kemungkinan berasal dari import lama yang tidak menyertakan kolom status. Klik tombol di bawah untuk mengubah semua status menjadi "aktif".'
                    : 'Tidak ada anggota yang perlu diperbaiki statusnya.'}
                </AlertDescription>
              </Alert>

              {anggotaTanpaStatus > 0 && (
                <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
                  <p className="font-medium">Yang akan dilakukan:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Mencari anggota dengan status kosong/null</li>
                    <li>Mengubah status menjadi "aktif"</li>
                    <li>Data lain tidak akan berubah</li>
                  </ul>
                </div>
              )}
            </>
          ) : (
            <Alert variant={result.success > 0 ? "default" : "destructive"}>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Perbaikan Selesai</AlertTitle>
              <AlertDescription>
                {result.success > 0 
                  ? `${result.success} data berhasil diperbarui dengan status "aktif"`
                  : 'Tidak ada data yang perlu diperbaiki'}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={processing}>
                Batal
              </Button>
              <Button 
                onClick={handleFix} 
                disabled={processing || anggotaTanpaStatus === 0}
              >
                {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Perbaiki Semua
              </Button>
            </>
          ) : (
            <Button onClick={() => handleClose(false)}>
              Tutup
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}