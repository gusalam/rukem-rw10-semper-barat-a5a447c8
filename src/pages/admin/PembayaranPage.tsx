import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiRealtime } from '@/hooks/use-realtime';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { SecureImage } from '@/components/ui/secure-image';
import { AdminIuranSkeleton } from '@/components/ui/admin-loading-skeleton';
import { useToast } from '@/hooks/use-toast';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, CheckCircle, XCircle, Eye, CreditCard, Clock, RefreshCw } from 'lucide-react';
import type { IuranPembayaran, IuranTagihan, Anggota, StatusPembayaranTagihan } from '@/types/database';
import { formatCurrency, formatDate, formatPeriode, formatDateTime } from '@/lib/format';
import { getErrorMessage, StandardMessages } from '@/lib/error-messages';

interface PembayaranWithDetails extends IuranPembayaran {
  tagihan?: IuranTagihan & { kepala_keluarga?: Anggota };
  penagih_name?: string;
}

export default function PembayaranPage() {
  const [pembayaranList, setPembayaranList] = useState<PembayaranWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('menunggu_admin');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPembayaran, setSelectedPembayaran] = useState<PembayaranWithDetails | null>(null);
  const [alasanTolak, setAlasanTolak] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      // Fetch pembayaran with tagihan details
      const { data: pembayaranData } = await supabase
        .from('iuran_pembayaran')
        .select(`
          *,
          iuran_tagihan!tagihan_id (*)
        `)
        .order('created_at', { ascending: false });

      // Get all no_kk from tagihan to fetch kepala keluarga
      const noKKList = [...new Set(pembayaranData?.map(p => (p.iuran_tagihan as any)?.no_kk).filter(Boolean))];
      
      // Fetch kepala keluarga for each KK
      const { data: anggotaData } = await supabase
        .from('anggota')
        .select('*')
        .in('no_kk', noKKList)
        .eq('hubungan_kk', 'Kepala Keluarga');

      // Fetch penagih profiles
      const penagihIds = [...new Set(pembayaranData?.map(p => p.penagih_user_id).filter(Boolean))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', penagihIds);

      // Map data together
      const pembayaranWithDetails = (pembayaranData || []).map(p => {
        const tagihan = p.iuran_tagihan as any;
        const kepala = anggotaData?.find(a => a.no_kk === tagihan?.no_kk);
        const penagih = profilesData?.find(pr => pr.user_id === p.penagih_user_id);
        
        return {
          ...p,
          tagihan: tagihan ? { ...tagihan, kepala_keluarga: kepala } : undefined,
          penagih_name: penagih?.full_name || 'Penagih',
        };
      });

      setPembayaranList(pembayaranWithDetails as PembayaranWithDetails[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscriptions
  useMultiRealtime(
    ['iuran_pembayaran', 'iuran_tagihan'],
    useCallback(() => {
      setIsLive(true);
      fetchData();
      setTimeout(() => setIsLive(false), 2000);
    }, [fetchData])
  );

  const openVerifyDialog = (pembayaran: PembayaranWithDetails) => {
    setSelectedPembayaran(pembayaran);
    setAlasanTolak('');
    setDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedPembayaran) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Update pembayaran status - trigger will handle tagihan status and kas
      const { error } = await supabase
        .from('iuran_pembayaran')
        .update({
          status: 'disetujui' as StatusPembayaranTagihan,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', selectedPembayaran.id);

      if (error) throw error;

      toast({
        title: '✓ Pembayaran Disetujui',
        description: 'Pembayaran telah disetujui dan dicatat ke kas.',
      });
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Menyetujui',
        description: getErrorMessage(error, StandardMessages.error.save),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPembayaran) return;

    if (!alasanTolak.trim()) {
      toast({
        variant: 'destructive',
        title: 'Alasan Diperlukan',
        description: 'Silakan isi alasan penolakan.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Update pembayaran status
      const { error } = await supabase
        .from('iuran_pembayaran')
        .update({
          status: 'ditolak' as StatusPembayaranTagihan,
          alasan_tolak: alasanTolak,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', selectedPembayaran.id);

      if (error) throw error;

      // Reset tagihan status back to belum_bayar
      await supabase
        .from('iuran_tagihan')
        .update({ status: 'belum_bayar' })
        .eq('id', selectedPembayaran.tagihan_id);

      toast({
        title: '✗ Pembayaran Ditolak',
        description: 'Pembayaran telah ditolak. Penagih dapat mengirim ulang pembayaran.',
      });
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Menolak',
        description: getErrorMessage(error, StandardMessages.error.save),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPembayaran = pembayaranList.filter((p) => {
    const matchSearch = 
      p.tagihan?.kepala_keluarga?.nama_lengkap?.toLowerCase().includes(search.toLowerCase()) ||
      p.tagihan?.no_kk?.includes(search) ||
      p.penagih_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount = pembayaranList.filter(p => p.status === 'menunggu_admin').length;

  const columns = [
    {
      key: 'tagihan',
      header: 'Tagihan',
      cell: (item: PembayaranWithDetails) => (
        <div>
          <p className="font-medium">{item.tagihan?.kepala_keluarga?.nama_lengkap || '-'}</p>
          <p className="text-xs text-muted-foreground font-mono">{item.tagihan?.no_kk}</p>
          <p className="text-xs text-muted-foreground">
            {item.tagihan?.periode ? formatPeriode(item.tagihan.periode) : '-'}
          </p>
        </div>
      ),
    },
    {
      key: 'penagih',
      header: 'Penagih',
      cell: (item: PembayaranWithDetails) => (
        <div>
          <p className="font-medium">{item.penagih_name}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(item.tanggal_bayar)}</p>
        </div>
      ),
      className: 'hidden md:table-cell',
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: PembayaranWithDetails) => (
        <div>
          <p className="font-medium">{formatCurrency(item.nominal)}</p>
          <Badge variant="outline" className="text-xs capitalize">{item.metode}</Badge>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: PembayaranWithDetails) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: '',
      cell: (item: PembayaranWithDetails) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openVerifyDialog(item)}
        >
          <Eye className="h-4 w-4 mr-1" />
          {item.status === 'menunggu_admin' ? 'Verifikasi' : 'Detail'}
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <PageHeader title="Verifikasi Pembayaran" description="Approve atau reject pembayaran dari penagih" />
        <AdminIuranSkeleton />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <PageHeader title="Verifikasi Pembayaran" description="Approve atau reject pembayaran dari penagih">
        <div className="flex items-center gap-2">
          {isLive && (
            <Badge variant="outline" className="animate-pulse bg-success/10 text-success border-success/30">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Live
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="destructive">
              <Clock className="h-3 w-3 mr-1" />
              {pendingCount} Menunggu
            </Badge>
          )}
        </div>
      </PageHeader>

      <div className="mt-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, no KK, penagih..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="menunggu_admin">Menunggu Admin</SelectItem>
              <SelectItem value="disetujui">Disetujui</SelectItem>
              <SelectItem value="ditolak">Ditolak</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredPembayaran.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Belum Ada Pembayaran"
            description={statusFilter === 'menunggu_admin' 
              ? "Tidak ada pembayaran yang menunggu verifikasi." 
              : "Belum ada data pembayaran."}
          />
        ) : (
          <DataTable columns={columns} data={filteredPembayaran} />
        )}
      </div>

      {/* Verify Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Pembayaran</DialogTitle>
          </DialogHeader>
          
          {selectedPembayaran && (
            <div className="space-y-4">
              {/* Tagihan Info */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kepala Keluarga</span>
                  <span className="font-medium">{selectedPembayaran.tagihan?.kepala_keluarga?.nama_lengkap}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. KK</span>
                  <span className="font-mono text-sm">{selectedPembayaran.tagihan?.no_kk}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Periode</span>
                  <span>{selectedPembayaran.tagihan?.periode ? formatPeriode(selectedPembayaran.tagihan.periode) : '-'}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Nominal Tagihan</span>
                  <span className="font-bold">{formatCurrency(selectedPembayaran.tagihan?.nominal || 0)}</span>
                </div>
              </div>

              {/* Pembayaran Info */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nominal Dibayar</span>
                  <span className="font-bold text-primary">{formatCurrency(selectedPembayaran.nominal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Metode</span>
                  <Badge variant="outline" className="capitalize">{selectedPembayaran.metode}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Penagih</span>
                  <span>{selectedPembayaran.penagih_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tanggal Bayar</span>
                  <span>{formatDateTime(selectedPembayaran.tanggal_bayar)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={selectedPembayaran.status} />
                </div>
              </div>

              {/* Bukti Pembayaran */}
              {selectedPembayaran.bukti_url && (
                <div className="space-y-2">
                  <Label>Bukti Pembayaran</Label>
                  <SecureImage
                    bucketName="bukti_pembayaran"
                    filePath={selectedPembayaran.bukti_url}
                    alt="Bukti pembayaran"
                    className="max-h-64 w-full object-contain rounded-lg border"
                  />
                </div>
              )}

              {/* Catatan */}
              {selectedPembayaran.catatan && (
                <div className="space-y-2">
                  <Label>Catatan dari Penagih</Label>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedPembayaran.catatan}</p>
                </div>
              )}

              {/* Alasan Tolak (jika ditolak) */}
              {selectedPembayaran.alasan_tolak && (
                <div className="space-y-2">
                  <Label className="text-destructive">Alasan Penolakan</Label>
                  <p className="text-sm bg-destructive/10 text-destructive p-3 rounded-lg">{selectedPembayaran.alasan_tolak}</p>
                </div>
              )}

              {/* Actions for pending */}
              {selectedPembayaran.status === 'menunggu_admin' && (
                <>
                  <div className="space-y-2">
                    <Label>Alasan Penolakan (jika ditolak)</Label>
                    <Textarea
                      value={alasanTolak}
                      onChange={(e) => setAlasanTolak(e.target.value)}
                      placeholder="Isi alasan jika ingin menolak pembayaran..."
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={submitting}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Tolak
                    </Button>
                    <Button
                      onClick={handleApprove}
                      disabled={submitting}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Setujui
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
