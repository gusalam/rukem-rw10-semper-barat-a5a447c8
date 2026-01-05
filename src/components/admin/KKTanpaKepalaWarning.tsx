import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { DataTable } from '@/components/ui/data-table';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Users, ArrowRight, Loader2, UserCog, Home } from 'lucide-react';
import type { Anggota, StatusDalamKK } from '@/types/database';

interface KKInfo {
  no_kk: string;
  members: Anggota[];
  activeMembersCount: number;
}

const STATUS_DALAM_KK_OPTIONS: { value: StatusDalamKK; label: string }[] = [
  { value: 'istri', label: 'Istri' },
  { value: 'anak', label: 'Anak' },
  { value: 'orang_tua', label: 'Orang Tua' },
  { value: 'famili', label: 'Famili' },
  { value: 'lainnya', label: 'Lainnya' },
];

interface KKTanpaKepalaWarningProps {
  kkTanpaKepalaCount: number;
  onDataChanged?: () => void;
}

export function KKTanpaKepalaWarning({ kkTanpaKepalaCount, onDataChanged }: KKTanpaKepalaWarningProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [kkList, setKKList] = useState<KKInfo[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedKK, setSelectedKK] = useState<KKInfo | null>(null);
  const [selectedNewKepala, setSelectedNewKepala] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchKKTanpaKepala = async () => {
    setLoading(true);
    try {
      // Fetch all active anggota
      const { data: allAnggota } = await supabase
        .from('anggota')
        .select('*')
        .eq('status', 'aktif')
        .order('no_kk')
        .order('nama_lengkap');

      if (!allAnggota) return;

      // Group by no_kk
      const kkMap = new Map<string, Anggota[]>();
      allAnggota.forEach(a => {
        const members = kkMap.get(a.no_kk) || [];
        members.push(a);
        kkMap.set(a.no_kk, members);
      });

      // Find KK without kepala_keluarga
      const kkTanpaKepala: KKInfo[] = [];
      kkMap.forEach((members, no_kk) => {
        const hasKepala = members.some(m => m.status_dalam_kk === 'kepala_keluarga');
        if (!hasKepala) {
          kkTanpaKepala.push({
            no_kk,
            members,
            activeMembersCount: members.length,
          });
        }
      });

      setKKList(kkTanpaKepala.slice(0, 20)); // Limit to 20 for performance
    } catch (error) {
      console.error('Error fetching KK tanpa kepala:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setDialogOpen(true);
    fetchKKTanpaKepala();
  };

  const openAssignDialog = (kk: KKInfo) => {
    setSelectedKK(kk);
    setSelectedNewKepala('');
    setAssignDialogOpen(true);
  };

  const handleAssignKepala = async () => {
    if (!selectedNewKepala || !selectedKK) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('anggota')
        .update({ status_dalam_kk: 'kepala_keluarga' })
        .eq('id', selectedNewKepala);

      if (error) throw error;

      const member = selectedKK.members.find(m => m.id === selectedNewKepala);
      toast({
        title: '✓ Kepala Keluarga Ditetapkan',
        description: `${member?.nama_lengkap} sekarang menjadi Kepala Keluarga.`,
      });

      setAssignDialogOpen(false);
      setDialogOpen(false);
      onDataChanged?.();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Menyimpan',
        description: error.message || 'Terjadi kesalahan.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (kkTanpaKepalaCount === 0) return null;

  const columns = [
    {
      key: 'no_kk',
      header: 'No. KK',
      cell: (item: KKInfo) => (
        <div>
          <p className="font-mono text-sm">{item.no_kk}</p>
          <p className="text-xs text-muted-foreground">{item.activeMembersCount} anggota aktif</p>
        </div>
      ),
    },
    {
      key: 'members',
      header: 'Anggota',
      cell: (item: KKInfo) => (
        <div className="flex flex-wrap gap-1">
          {item.members.slice(0, 3).map((m, idx) => (
            <Badge key={m.id} variant="outline" className="text-xs">
              {m.nama_lengkap.split(' ')[0]}
            </Badge>
          ))}
          {item.members.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{item.members.length - 3}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (item: KKInfo) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openAssignDialog(item)}
        >
          <UserCog className="h-4 w-4 mr-1" />
          Tetapkan Kepala
        </Button>
      ),
    },
  ];

  return (
    <>
      <Alert variant="destructive" className="border-warning bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle className="text-warning">KK Tanpa Kepala Keluarga</AlertTitle>
        <AlertDescription className="mt-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm">
              Ditemukan <span className="font-bold">{kkTanpaKepalaCount} KK</span> yang tidak memiliki Kepala Keluarga aktif. 
              KK tanpa kepala tidak dapat ditagih iuran.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleOpenDialog}
              className="shrink-0 border-warning text-warning hover:bg-warning/10"
            >
              <Home className="h-4 w-4 mr-2" />
              Perbaiki Sekarang
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {/* List KK Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-warning" />
              KK Tanpa Kepala Keluarga
            </DialogTitle>
            <DialogDescription>
              Pilih anggota untuk ditetapkan sebagai Kepala Keluarga. Menampilkan maksimal 20 KK.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : kkList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada KK tanpa Kepala Keluarga
            </div>
          ) : (
            <DataTable data={kkList} columns={columns} />
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Tutup
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/migrasi-data')}>
              Buka Halaman Migrasi
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Kepala Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tetapkan Kepala Keluarga</DialogTitle>
            <DialogDescription>
              Pilih anggota yang akan menjadi Kepala Keluarga untuk KK ini.
            </DialogDescription>
          </DialogHeader>

          {selectedKK && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Nomor KK</p>
                <p className="font-mono font-medium">{selectedKK.no_kk}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Pilih Kepala Keluarga <span className="text-destructive">*</span></label>
                <Select value={selectedNewKepala} onValueChange={setSelectedNewKepala}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih anggota..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedKK.members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex flex-col">
                          <span>{member.nama_lengkap}</span>
                          <span className="text-xs text-muted-foreground">
                            {member.jenis_kelamin === 'L' ? 'Laki-laki' : member.jenis_kelamin === 'P' ? 'Perempuan' : '-'}
                            {member.status_dalam_kk && ` • ${member.status_dalam_kk}`}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAssignDialogOpen(false)} disabled={submitting}>
                  Batal
                </Button>
                <Button onClick={handleAssignKepala} disabled={submitting || !selectedNewKepala}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Tetapkan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
