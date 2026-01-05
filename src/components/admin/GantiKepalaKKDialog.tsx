import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/status-badge';
import { AlertTriangle, Users, ArrowRight, Loader2 } from 'lucide-react';
import type { Anggota, StatusDalamKK } from '@/types/database';

interface GantiKepalaKKDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentKepala: Anggota;
  onSuccess: () => void;
}

const STATUS_DALAM_KK_OPTIONS: { value: StatusDalamKK; label: string }[] = [
  { value: 'istri', label: 'Istri' },
  { value: 'anak', label: 'Anak' },
  { value: 'orang_tua', label: 'Orang Tua' },
  { value: 'famili', label: 'Famili' },
  { value: 'lainnya', label: 'Lainnya' },
];

export function GantiKepalaKKDialog({
  open,
  onOpenChange,
  currentKepala,
  onSuccess,
}: GantiKepalaKKDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<Anggota[]>([]);
  const [selectedNewKepala, setSelectedNewKepala] = useState<string>('');
  const [oldKepalaNewStatus, setOldKepalaNewStatus] = useState<StatusDalamKK>('lainnya');
  const { toast } = useToast();

  // Fetch family members when dialog opens
  useEffect(() => {
    if (open && currentKepala) {
      fetchFamilyMembers();
    }
  }, [open, currentKepala]);

  const fetchFamilyMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('anggota')
        .select('*')
        .eq('no_kk', currentKepala.no_kk)
        .neq('id', currentKepala.id)
        .eq('status', 'aktif') // Only active members can become new head
        .order('nama_lengkap');

      if (error) throw error;
      setFamilyMembers(data as Anggota[]);
    } catch (error) {
      console.error('Error fetching family members:', error);
      toast({
        variant: 'destructive',
        title: 'Gagal Memuat Data',
        description: 'Tidak dapat mengambil data anggota keluarga.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedNewKepala) {
      toast({
        variant: 'destructive',
        title: 'Pilih Kepala Keluarga Baru',
        description: 'Silakan pilih anggota yang akan menjadi Kepala Keluarga baru.',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Use a transaction-like approach: update old kepala first, then new kepala
      // Step 1: Update old kepala to new status
      const { error: errorOld } = await supabase
        .from('anggota')
        .update({ status_dalam_kk: oldKepalaNewStatus })
        .eq('id', currentKepala.id);

      if (errorOld) throw errorOld;

      // Step 2: Update new kepala
      const { error: errorNew } = await supabase
        .from('anggota')
        .update({ status_dalam_kk: 'kepala_keluarga' })
        .eq('id', selectedNewKepala);

      if (errorNew) {
        // Rollback: restore old kepala status
        await supabase
          .from('anggota')
          .update({ status_dalam_kk: 'kepala_keluarga' })
          .eq('id', currentKepala.id);
        throw errorNew;
      }

      const newKepalaName = familyMembers.find(m => m.id === selectedNewKepala)?.nama_lengkap;
      toast({
        title: '✓ Kepala Keluarga Diganti',
        description: `${newKepalaName} sekarang menjadi Kepala Keluarga baru.`,
      });
      
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error changing kepala keluarga:', error);
      toast({
        variant: 'destructive',
        title: 'Gagal Mengganti Kepala Keluarga',
        description: error.message || 'Terjadi kesalahan saat memproses data.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedNewKepala('');
    setOldKepalaNewStatus('lainnya');
    onOpenChange(false);
  };

  const selectedMember = familyMembers.find(m => m.id === selectedNewKepala);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Ganti Kepala Keluarga
          </DialogTitle>
          <DialogDescription>
            Pilih anggota keluarga aktif untuk menggantikan Kepala Keluarga saat ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Kepala Info */}
          <div className="p-3 bg-muted/50 rounded-lg border">
            <p className="text-xs text-muted-foreground mb-1">Kepala Keluarga Saat Ini</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{currentKepala.nama_lengkap}</p>
                <p className="text-xs text-muted-foreground">KK: {currentKepala.no_kk}</p>
              </div>
              <StatusBadge status={currentKepala.status} />
            </div>
          </div>

          {/* Warning if current kepala is meninggal or nonaktif */}
          {(currentKepala.status === 'meninggal' || currentKepala.status === 'nonaktif') && (
            <Alert variant="default" className="border-warning bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-sm">
                Kepala Keluarga saat ini berstatus <strong>{currentKepala.status === 'meninggal' ? 'Meninggal' : 'Tidak Aktif'}</strong>. 
                Silakan pilih anggota aktif sebagai pengganti.
              </AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : familyMembers.length === 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Tidak ada anggota keluarga aktif yang dapat dipilih sebagai Kepala Keluarga baru.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Select New Kepala */}
              <div className="space-y-2">
                <Label>Kepala Keluarga Baru <span className="text-destructive">*</span></Label>
                <Select value={selectedNewKepala} onValueChange={setSelectedNewKepala}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih anggota keluarga..." />
                  </SelectTrigger>
                  <SelectContent>
                    {familyMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex flex-col">
                          <span>{member.nama_lengkap}</span>
                          <span className="text-xs text-muted-foreground">
                            {member.status_dalam_kk ? 
                              (member.status_dalam_kk === 'istri' ? 'Istri' :
                               member.status_dalam_kk === 'anak' ? 'Anak' :
                               member.status_dalam_kk === 'orang_tua' ? 'Orang Tua' :
                               member.status_dalam_kk === 'famili' ? 'Famili' : 'Lainnya') 
                              : '-'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Old Kepala New Status */}
              <div className="space-y-2">
                <Label>Status Baru untuk {currentKepala.nama_lengkap}</Label>
                <Select 
                  value={oldKepalaNewStatus} 
                  onValueChange={(v) => setOldKepalaNewStatus(v as StatusDalamKK)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_DALAM_KK_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Status baru kepala keluarga lama setelah diganti
                </p>
              </div>

              {/* Preview Changes */}
              {selectedNewKepala && (
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-xs font-medium text-primary mb-2">Perubahan yang akan dilakukan:</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{currentKepala.nama_lengkap}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-medium">
                        {STATUS_DALAM_KK_OPTIONS.find(o => o.value === oldKepalaNewStatus)?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{selectedMember?.nama_lengkap}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-medium text-primary">Kepala Keluarga</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Batal
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={submitting || loading || familyMembers.length === 0 || !selectedNewKepala}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Ganti Kepala Keluarga
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
