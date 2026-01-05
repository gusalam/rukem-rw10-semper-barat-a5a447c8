import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { ImageUpload } from '@/components/ui/image-upload';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Receipt, MapPin, CreditCard, Clock, Calendar, X, Filter } from 'lucide-react';
import type { IuranTagihan, IuranPembayaran, Anggota, MetodePembayaran } from '@/types/database';
import { formatCurrency, formatDate, formatPeriode } from '@/lib/format';
import { getErrorMessage } from '@/lib/error-messages';

interface TagihanWithKK extends IuranTagihan {
  kepala_keluarga?: Anggota;
}

// Generate period options (last 24 months)
const generatePeriodOptions = () => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  
  for (let i = 0; i < 24; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${month}`;
    
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const label = `${monthNames[date.getMonth()]} ${year}`;
    
    options.push({ value, label });
  }
  
  return options;
};

const periodOptions = generatePeriodOptions();

export default function PenagihTagihanPage() {
  const { user, penagihWilayah } = useAuth();
  const { toast } = useToast();
  const [tagihanList, setTagihanList] = useState<TagihanWithKK[]>([]);
  const [pembayaranList, setPembayaranList] = useState<IuranPembayaran[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPeriode, setFilterPeriode] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('belum_bayar');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedTagihan, setSelectedTagihan] = useState<TagihanWithKK | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<MetodePembayaran>('tunai');
  const [buktiUrl, setBuktiUrl] = useState('');
  const [catatan, setCatatan] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (penagihWilayah.length > 0) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [penagihWilayah]);

  const fetchData = async () => {
    try {
      // Get anggota in penagih wilayah first
      const { data: anggotaData } = await supabase
        .from('anggota')
        .select('*')
        .eq('status', 'aktif');

      if (!anggotaData) return;

      // Filter by wilayah - hanya ambil Kepala Keluarga dengan RT/RW tidak kosong
      const rtRwPairs = penagihWilayah.map(w => ({ rt: w.rt, rw: w.rw }));
      
      // Filter kepala keluarga di wilayah penagih yang memiliki RT/RW lengkap
      const kepalaKeluargaList = anggotaData.filter(a => 
        a.status_dalam_kk === 'kepala_keluarga' &&
        a.rt && a.rw &&
        rtRwPairs.some(pair => pair.rt === a.rt && pair.rw === a.rw)
      );

      // Ambil semua anggota dari KK yang memiliki kepala keluarga valid
      const validKKs = kepalaKeluargaList.map(k => k.no_kk);
      const filteredAnggota = anggotaData.filter(a => validKKs.includes(a.no_kk));
      
      const uniqueKKs = validKKs;

      if (uniqueKKs.length === 0) {
        setTagihanList([]);
        setPembayaranList([]);
        return;
      }

      // Get tagihan for these KKs
      const { data: tagihanData } = await supabase
        .from('iuran_tagihan')
        .select('*')
        .in('no_kk', uniqueKKs)
        .order('jatuh_tempo', { ascending: false });

      // Map kepala keluarga to tagihan
      const tagihanWithKK = (tagihanData || []).map(t => {
        const kepala = filteredAnggota.find(a => 
          a.no_kk === t.no_kk && a.status_dalam_kk === 'kepala_keluarga'
        ) || filteredAnggota.find(a => a.no_kk === t.no_kk);
        return { ...t, kepala_keluarga: kepala } as TagihanWithKK;
      });

      setTagihanList(tagihanWithKK);

      // Get pembayaran by this penagih
      if (user) {
        const { data: pembayaranData } = await supabase
          .from('iuran_pembayaran')
          .select('*, tagihan:iuran_tagihan(*)')
          .eq('penagih_user_id', user.id)
          .order('created_at', { ascending: false });

        setPembayaranList((pembayaranData || []) as IuranPembayaran[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openPaymentDialog = (tagihan: TagihanWithKK) => {
    setSelectedTagihan(tagihan);
    setPaymentMethod('tunai');
    setBuktiUrl('');
    setCatatan('');
    setPaymentDialogOpen(true);
  };

  const handleSubmitPayment = async () => {
    if (!selectedTagihan || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('iuran_pembayaran')
        .insert({
          tagihan_id: selectedTagihan.id,
          penagih_user_id: user.id,
          nominal: selectedTagihan.nominal,
          metode: paymentMethod,
          bukti_url: buktiUrl || null,
          catatan: catatan || null,
          status: 'menunggu_admin',
        });

      if (error) throw error;

      // Update tagihan status to menunggu_admin
      await supabase
        .from('iuran_tagihan')
        .update({ status: 'menunggu_admin' })
        .eq('id', selectedTagihan.id);

      toast({
        title: 'Pembayaran Dicatat',
        description: 'Pembayaran berhasil dicatat dan menunggu persetujuan admin.',
      });

      setPaymentDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Mencatat Pembayaran',
        description: getErrorMessage(error, 'Terjadi kesalahan saat mencatat pembayaran'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTagihan = tagihanList.filter(t => {
    const matchesSearch = 
      t.no_kk.includes(search) ||
      t.kepala_keluarga?.nama_lengkap.toLowerCase().includes(search.toLowerCase()) ||
      t.periode.includes(search);
    
    const matchesPeriode = filterPeriode === 'all' || t.periode === filterPeriode;
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    
    return matchesSearch && matchesPeriode && matchesStatus;
  });

  const displayedTagihan = filteredTagihan;
  const belumBayarCount = tagihanList.filter(t => t.status === 'belum_bayar').length;

  const tagihanColumns = [
    {
      key: 'no_kk',
      header: 'Kepala Keluarga',
      cell: (item: TagihanWithKK) => (
        <div>
          <p className="font-medium">{item.kepala_keluarga?.nama_lengkap || '-'}</p>
          <p className="text-xs text-muted-foreground">{item.no_kk}</p>
        </div>
      ),
    },
    {
      key: 'periode',
      header: 'Periode',
      cell: (item: TagihanWithKK) => formatPeriode(item.periode),
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: TagihanWithKK) => formatCurrency(item.nominal),
    },
    {
      key: 'jatuh_tempo',
      header: 'Jatuh Tempo',
      cell: (item: TagihanWithKK) => formatDate(item.jatuh_tempo),
      className: 'hidden md:table-cell',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: TagihanWithKK) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: '',
      cell: (item: TagihanWithKK) => item.status === 'belum_bayar' && (
        <Button
          size="sm"
          onClick={() => openPaymentDialog(item)}
        >
          <CreditCard className="h-4 w-4 mr-1" />
          Bayar
        </Button>
      ),
    },
  ];

  const pembayaranColumns = [
    {
      key: 'tagihan',
      header: 'Tagihan',
      cell: (item: IuranPembayaran) => (
        <div>
          <p className="font-medium">{item.tagihan?.no_kk || '-'}</p>
          <p className="text-xs text-muted-foreground">
            {item.tagihan ? formatPeriode(item.tagihan.periode) : '-'}
          </p>
        </div>
      ),
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: IuranPembayaran) => formatCurrency(item.nominal),
    },
    {
      key: 'tanggal',
      header: 'Tanggal',
      cell: (item: IuranPembayaran) => formatDate(item.tanggal_bayar),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: IuranPembayaran) => <StatusBadge status={item.status} />,
    },
  ];

  if (loading) {
    return (
      <PenagihLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
        </div>
      </PenagihLayout>
    );
  }

  return (
    <PenagihLayout>
      <PageHeader 
        title="Tagihan Iuran" 
        description="Kelola tagihan iuran di wilayah Anda"
      />

      {penagihWilayah.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Belum Ada Wilayah"
          description="Anda belum ditugaskan ke wilayah manapun"
        />
      ) : (
        <Tabs defaultValue="tagihan" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tagihan" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Tagihan ({belumBayarCount})
            </TabsTrigger>
            <TabsTrigger value="riwayat" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Riwayat ({pembayaranList.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tagihan" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari No. KK, nama..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[160px] pl-9">
                      <SelectValue placeholder="Filter Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
                      <SelectItem value="menunggu_admin">Menunggu Admin</SelectItem>
                      <SelectItem value="lunas">Lunas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Periode Filter */}
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                  <Select value={filterPeriode} onValueChange={setFilterPeriode}>
                    <SelectTrigger className="w-[180px] pl-9">
                      <SelectValue placeholder="Filter Periode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Periode</SelectItem>
                      {periodOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {(filterPeriode !== 'all' || filterStatus !== 'belum_bayar') && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setFilterPeriode('all');
                      setFilterStatus('belum_bayar');
                    }}
                    title="Reset filter"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {displayedTagihan.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Tidak Ada Tagihan"
                description={filterStatus === 'all' ? "Tidak ada tagihan di wilayah Anda" : `Tidak ada tagihan dengan status "${filterStatus === 'belum_bayar' ? 'Belum Bayar' : filterStatus === 'menunggu_admin' ? 'Menunggu Admin' : 'Lunas'}"`}
              />
            ) : (
              <DataTable
                columns={tagihanColumns}
                data={displayedTagihan}
              />
            )}
          </TabsContent>

          <TabsContent value="riwayat" className="space-y-4">
            {pembayaranList.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Belum Ada Riwayat"
                description="Anda belum mencatat pembayaran apapun"
              />
            ) : (
              <DataTable
                columns={pembayaranColumns}
                data={pembayaranList}
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat Pembayaran</DialogTitle>
          </DialogHeader>
          
          {selectedTagihan && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kepala Keluarga</span>
                  <span className="font-medium">{selectedTagihan.kepala_keluarga?.nama_lengkap}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. KK</span>
                  <span className="font-medium">{selectedTagihan.no_kk}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Periode</span>
                  <span className="font-medium">{formatPeriode(selectedTagihan.periode)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nominal</span>
                  <span className="font-bold text-primary">{formatCurrency(selectedTagihan.nominal)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Metode Pembayaran</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as MetodePembayaran)}
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

              {paymentMethod !== 'tunai' && (
                <div className="space-y-2">
                  <Label>Bukti Pembayaran (Opsional)</Label>
                  <ImageUpload
                    value={buktiUrl}
                    onChange={setBuktiUrl}
                    bucket="bukti_pembayaran"
                    folder="penagih"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Catatan (Opsional)</Label>
                <Input
                  placeholder="Catatan tambahan..."
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                />
              </div>

              <Button 
                className="w-full" 
                onClick={handleSubmitPayment}
                disabled={submitting}
              >
                {submitting ? 'Menyimpan...' : 'Catat Pembayaran'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PenagihLayout>
  );
}
