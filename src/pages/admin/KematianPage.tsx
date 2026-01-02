import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/hooks/use-toast';
import { StandardMessages, getErrorMessage } from '@/lib/error-messages';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { Plus, Skull, AlertTriangle, Trash2 } from 'lucide-react';
import type { Kematian, Anggota, IuranTagihan, Pengaturan } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/format';

export default function KematianPage() {
  const [kematianList, setKematianList] = useState<Kematian[]>([]);
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKematian, setSelectedKematian] = useState<Kematian | null>(null);
  const [formData, setFormData] = useState({
    anggota_id: '',
    tanggal_meninggal: new Date().toISOString().split('T')[0],
    tempat_meninggal: '',
    penyebab: '',
    keterangan: '',
  });
  const [selectedAnggotaInfo, setSelectedAnggotaInfo] = useState<{
    tunggakan: number;
    tagihanBelumBayar: IuranTagihan[];
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [kematianRes, anggotaRes, pengaturanRes] = await Promise.all([
        supabase.from('kematian').select('*, anggota(*)').order('created_at', { ascending: false }),
        supabase.from('anggota').select('*').eq('status', 'aktif').order('nama_lengkap'),
        supabase.from('pengaturan').select('*').limit(1).maybeSingle(),
      ]);

      setKematianList(kematianRes.data as Kematian[] || []);
      setAnggotaList(anggotaRes.data as Anggota[] || []);
      setPengaturan(pengaturanRes.data as Pengaturan);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnggotaChange = async (anggotaId: string) => {
    setFormData({ ...formData, anggota_id: anggotaId });
    
    // Get anggota's no_kk to find tagihan
    const anggota = anggotaList.find(a => a.id === anggotaId);
    if (!anggota) return;

    // Fetch tunggakan info from iuran_tagihan based on no_kk
    const { data: tagihanData } = await supabase
      .from('iuran_tagihan')
      .select('*')
      .eq('no_kk', anggota.no_kk)
      .in('status', ['belum_bayar', 'menunggu_admin']);

    const tunggakan = tagihanData?.reduce((sum, t) => sum + t.nominal, 0) || 0;
    setSelectedAnggotaInfo({
      tunggakan,
      tagihanBelumBayar: tagihanData as IuranTagihan[] || [],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.anggota_id || !formData.tanggal_meninggal) {
      toast({
        variant: 'destructive',
        title: '⚠️ Perhatian',
        description: StandardMessages.validation.required,
      });
      return;
    }

    // Check for duplicate - prevent double entry for same anggota
    const existingKematian = kematianList.find(k => k.anggota_id === formData.anggota_id);
    if (existingKematian) {
      const anggotaNama = anggotaList.find(a => a.id === formData.anggota_id)?.nama_lengkap || 'Anggota';
      toast({
        variant: 'destructive',
        title: '⚠️ Data Duplikat',
        description: `Data kematian untuk ${anggotaNama} sudah tercatat sebelumnya. Tidak dapat mencatat data kematian yang sama dua kali.`,
      });
      return;
    }

    // Check if anggota status is already 'meninggal'
    const selectedAnggota = anggotaList.find(a => a.id === formData.anggota_id);
    if (selectedAnggota?.status === 'meninggal') {
      toast({
        variant: 'destructive',
        title: '⚠️ Status Tidak Valid',
        description: `${selectedAnggota.nama_lengkap} sudah berstatus meninggal.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Sesi tidak valid. Silakan login ulang.');
      }

      // Create kematian record
      const { data: kematianData, error: kematianError } = await supabase
        .from('kematian')
        .insert({
          anggota_id: formData.anggota_id,
          tanggal_meninggal: formData.tanggal_meninggal,
          tempat_meninggal: formData.tempat_meninggal || null,
          penyebab: formData.penyebab || null,
          keterangan: formData.keterangan || null,
          tunggakan_total: selectedAnggotaInfo?.tunggakan || 0,
          created_by: user.id,
        })
        .select()
        .single();

      if (kematianError) {
        console.error('Kematian insert error:', kematianError);
        throw new Error(`Gagal menyimpan data kematian: ${kematianError.message}`);
      }

      // Update anggota status
      const { error: anggotaError } = await supabase
        .from('anggota')
        .update({ status: 'meninggal' })
        .eq('id', formData.anggota_id);

      if (anggotaError) {
        console.error('Anggota update error:', anggotaError);
        // Don't throw, just log - kematian is already saved
      }

      // Create santunan record
      if (pengaturan && kematianData) {
        const tunggakan = selectedAnggotaInfo?.tunggakan || 0;
        const nominalAkhir = Math.max(0, pengaturan.nominal_santunan - tunggakan);

        const { error: santunanError } = await supabase.from('santunan').insert({
          kematian_id: kematianData.id,
          anggota_id: formData.anggota_id,
          nominal_dasar: pengaturan.nominal_santunan,
          potongan_tunggakan: tunggakan,
          nominal_akhir: nominalAkhir,
          status: 'pending',
        });

        if (santunanError) {
          console.error('Santunan insert error:', santunanError);
          // Don't throw, just log - kematian is already saved
        }
      }

      toast({ 
        title: '✓ Data Kematian Dicatat', 
        description: StandardMessages.success.kematian.add 
      });
      setDialogOpen(false);
      setFormData({
        anggota_id: '',
        tanggal_meninggal: new Date().toISOString().split('T')[0],
        tempat_meninggal: '',
        penyebab: '',
        keterangan: '',
      });
      setSelectedAnggotaInfo(null);
      fetchData();
    } catch (error: unknown) {
      console.error('Kematian submit error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan data';
      toast({
        variant: 'destructive',
        title: '✕ Gagal Menyimpan',
        description: errorMessage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (kematian: Kematian) => {
    setSelectedKematian(kematian);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedKematian) return;

    setSubmitting(true);
    try {
      // Delete related santunan first
      await supabase.from('santunan').delete().eq('kematian_id', selectedKematian.id);
      
      // Delete kematian record
      const { error } = await supabase.from('kematian').delete().eq('id', selectedKematian.id);
      if (error) throw error;

      // Restore anggota status to aktif
      await supabase.from('anggota').update({ status: 'aktif' }).eq('id', selectedKematian.anggota_id);

      toast({ 
        title: '✓ Data Dihapus', 
        description: StandardMessages.success.delete 
      });
      setDeleteDialogOpen(false);
      setSelectedKematian(null);
      fetchData();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: '✕ Gagal',
        description: getErrorMessage(error, StandardMessages.error.delete),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'anggota',
      header: 'Nama Anggota',
      cell: (item: Kematian) => item.anggota?.nama_lengkap || '-',
    },
    {
      key: 'tanggal_meninggal',
      header: 'Tanggal Meninggal',
      cell: (item: Kematian) => formatDate(item.tanggal_meninggal),
    },
    {
      key: 'tempat_meninggal',
      header: 'Tempat',
      className: 'hidden md:table-cell',
    },
    {
      key: 'tunggakan_total',
      header: 'Tunggakan',
      cell: (item: Kematian) => formatCurrency(item.tunggakan_total || 0),
      className: 'hidden md:table-cell',
    },
    {
      key: 'actions',
      header: '',
      cell: (item: Kematian) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            openDeleteDialog(item);
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ),
    },
  ];

  return (
    <AdminLayout>
      <PageHeader title="Data Kematian" description="Catat dan kelola data kematian anggota">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Catat Kematian
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Catat Data Kematian</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Anggota *</Label>
                <Select
                  value={formData.anggota_id}
                  onValueChange={handleAnggotaChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih anggota" />
                  </SelectTrigger>
                  <SelectContent>
                    {anggotaList.map((anggota) => (
                      <SelectItem key={anggota.id} value={anggota.id}>
                        {anggota.nama_lengkap}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedAnggotaInfo && selectedAnggotaInfo.tunggakan > 0 && (
                <Card className="border-warning bg-warning/5">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Ada Tunggakan Iuran</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Total: {formatCurrency(selectedAnggotaInfo.tunggakan)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Akan dipotong dari santunan
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <Label>Tanggal Meninggal *</Label>
                <Input
                  type="date"
                  value={formData.tanggal_meninggal}
                  onChange={(e) => setFormData({ ...formData, tanggal_meninggal: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tempat Meninggal</Label>
                <Input
                  placeholder="Rumah Sakit / Rumah"
                  value={formData.tempat_meninggal}
                  onChange={(e) => setFormData({ ...formData, tempat_meninggal: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Penyebab</Label>
                <Input
                  placeholder="Sakit / Kecelakaan"
                  value={formData.penyebab}
                  onChange={(e) => setFormData({ ...formData, penyebab: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Keterangan</Label>
                <Textarea
                  placeholder="Keterangan tambahan..."
                  value={formData.keterangan}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                />
              </div>

              {pengaturan && formData.anggota_id && (
                <Card className="bg-muted">
                  <CardContent className="pt-4">
                    <p className="text-sm font-medium">Estimasi Santunan</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nominal Dasar</span>
                        <span>{formatCurrency(pengaturan.nominal_santunan)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Potongan Tunggakan</span>
                        <span className="text-destructive">
                          -{formatCurrency(selectedAnggotaInfo?.tunggakan || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t font-bold">
                        <span>Santunan Akhir</span>
                        <span className="text-primary">
                          {formatCurrency(Math.max(0, pengaturan.nominal_santunan - (selectedAnggotaInfo?.tunggakan || 0)))}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan Data'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Hapus Data Kematian?"
        description={`Data kematian "${selectedKematian?.anggota?.nama_lengkap}" akan dihapus dan status anggota dikembalikan ke aktif.`}
        loading={submitting}
      />

      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : kematianList.length === 0 ? (
          <EmptyState
            icon={Skull}
            title="Belum ada data"
            description="Data kematian anggota akan tercatat di sini"
          />
        ) : (
          <DataTable columns={columns} data={kematianList} />
        )}
      </div>
    </AdminLayout>
  );
}
