import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageUpload } from '@/components/ui/image-upload';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditCard, Search, Plus, MapPin } from 'lucide-react';
import { formatCurrency, formatPeriode } from '@/lib/format';
import { toast } from 'sonner';
import type { IuranTagihan, Anggota, MetodePembayaran } from '@/types/database';

interface TagihanWithKK extends IuranTagihan {
  kepala_keluarga?: Anggota;
}

export default function InputPembayaranPage() {
  const { user, penagihWilayah } = useAuth();
  const [tagihanList, setTagihanList] = useState<TagihanWithKK[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTagihan, setSelectedTagihan] = useState<TagihanWithKK | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    nominal: '',
    metode: 'tunai' as MetodePembayaran,
    catatan: '',
    bukti_url: '',
  });

  const fetchData = useCallback(async () => {
    if (!user || penagihWilayah.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const rtRwPairs = penagihWilayah.map(w => ({ rt: w.rt, rw: w.rw }));
      
      const { data: anggotaData } = await supabase
        .from('anggota')
        .select('id, no_kk, rt, rw, nama_lengkap, status_dalam_kk')
        .eq('status', 'aktif');
      
      // Filter hanya Kepala Keluarga dengan RT/RW lengkap di wilayah penagih
      const kepalaKeluargaList = anggotaData?.filter(a => 
        a.status_dalam_kk === 'kepala_keluarga' &&
        a.rt && a.rw &&
        rtRwPairs.some(pair => pair.rt === a.rt && pair.rw === a.rw)
      ) || [];
      
      const validKKs = kepalaKeluargaList.map(k => k.no_kk);
      const filteredAnggota = anggotaData?.filter(a => validKKs.includes(a.no_kk)) || [];
      const uniqueKKs = validKKs;

      if (uniqueKKs.length === 0) {
        setTagihanList([]);
        setLoading(false);
        return;
      }

      // Hanya ambil tagihan dengan status 'belum_bayar' saja
      // Tagihan yang sudah diinput (menunggu_admin) atau lunas tidak ditampilkan
      const { data: tagihanData } = await supabase
        .from('iuran_tagihan')
        .select('*')
        .in('no_kk', uniqueKKs)
        .eq('status', 'belum_bayar')
        .order('jatuh_tempo', { ascending: true });

      const processedData: TagihanWithKK[] = (tagihanData || []).map(t => {
        const kepala = filteredAnggota.find(a => a.no_kk === t.no_kk && a.status_dalam_kk === 'kepala_keluarga')
          || filteredAnggota.find(a => a.no_kk === t.no_kk);
        return { ...t, kepala_keluarga: kepala as Anggota };
      });

      setTagihanList(processedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, penagihWilayah]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('penagih-input-pembayaran-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iuran_tagihan' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iuran_pembayaran' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchData]);

  const openPaymentDialog = (tagihan: TagihanWithKK) => {
    setSelectedTagihan(tagihan);
    setFormData({
      nominal: tagihan.nominal.toString(),
      metode: 'tunai',
      catatan: '',
      bukti_url: '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTagihan || !user) return;

    const nominal = parseInt(formData.nominal);
    if (!nominal || nominal <= 0) {
      toast.error('Nominal pembayaran tidak valid');
      return;
    }

    setSubmitting(true);
    try {
      const { error: pembayaranError } = await supabase
        .from('iuran_pembayaran')
        .insert({
          tagihan_id: selectedTagihan.id,
          penagih_user_id: user.id,
          nominal,
          metode: formData.metode,
          catatan: formData.catatan || null,
          bukti_url: formData.bukti_url || null,
          status: 'menunggu_admin',
          tanggal_bayar: new Date().toISOString(),
        });

      if (pembayaranError) throw pembayaranError;

      const { error: tagihanError } = await supabase
        .from('iuran_tagihan')
        .update({ status: 'menunggu_admin' })
        .eq('id', selectedTagihan.id);

      if (tagihanError) throw tagihanError;

      // Optimistic update: langsung hapus item dari list
      setTagihanList(prev => prev.filter(t => t.id !== selectedTagihan.id));
      
      toast.success('Pembayaran berhasil diinput, menunggu verifikasi admin');
      setDialogOpen(false);
      setSelectedTagihan(null);
    } catch (error: any) {
      console.error('Error submitting payment:', error);
      toast.error(error.message || 'Gagal menyimpan pembayaran');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTagihan = tagihanList.filter(t => 
    t.kepala_keluarga?.nama_lengkap?.toLowerCase().includes(search.toLowerCase()) ||
    t.no_kk?.toLowerCase().includes(search.toLowerCase()) ||
    t.periode?.includes(search)
  );

  if (loading) {
    return (
      <PenagihLayout title="Input Pembayaran">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </PenagihLayout>
    );
  }

  return (
    <PenagihLayout title="Input Pembayaran">
      <div className="space-y-4">
        {/* Header Card */}
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/20">
                <CreditCard className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Input Pembayaran</h2>
                <p className="text-sm text-muted-foreground">{filteredTagihan.length} tagihan belum dibayar</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {penagihWilayah.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Belum Ada Wilayah"
            description="Anda belum ditugaskan ke wilayah manapun"
          />
        ) : (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama KK, No. KK, atau periode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Tagihan List */}
            <div className="space-y-3">
              {filteredTagihan.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title="Tidak Ada Tagihan"
                  description={search ? 'Tidak ada tagihan yang sesuai pencarian.' : 'Semua tagihan sudah dibayar atau sedang menunggu verifikasi.'}
                />
              ) : (
                filteredTagihan.map((item) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="p-2 rounded-lg bg-destructive/10 shrink-0">
                            <CreditCard className="h-5 w-5 text-destructive" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{item.kepala_keluarga?.nama_lengkap || '-'}</p>
                            <p className="text-xs text-muted-foreground">KK: {item.no_kk}</p>
                            <p className="text-sm text-primary font-medium mt-1">
                              {formatPeriode(item.periode)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="font-bold text-destructive">{formatCurrency(item.nominal)}</p>
                          <Button
                            size="sm"
                            className="mt-2"
                            onClick={() => openPaymentDialog(item)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Bayar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Input Pembayaran</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {selectedTagihan && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-1">
                  <p className="text-sm font-medium">{selectedTagihan.kepala_keluarga?.nama_lengkap}</p>
                  <p className="text-xs text-muted-foreground">Periode: {formatPeriode(selectedTagihan.periode)}</p>
                  <p className="text-xs text-muted-foreground">Tagihan: {formatCurrency(selectedTagihan.nominal)}</p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label>Nominal Pembayaran *</Label>
              <Input
                type="number"
                value={formData.nominal}
                onChange={(e) => setFormData({ ...formData, nominal: e.target.value })}
                placeholder="Masukkan nominal"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Metode Pembayaran *</Label>
              <Select 
                value={formData.metode} 
                onValueChange={(v) => setFormData({ ...formData, metode: v as MetodePembayaran })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tunai">Tunai</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="qris">QRIS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bukti Pembayaran</Label>
              <ImageUpload
                value={formData.bukti_url}
                onChange={(url) => setFormData({ ...formData, bukti_url: url })}
                bucket="bukti_pembayaran"
              />
            </div>

            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={formData.catatan}
                onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                placeholder="Catatan tambahan (opsional)"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PenagihLayout>
  );
}
