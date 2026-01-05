import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Receipt, 
  Filter, 
  X, 
  TrendingUp, 
  Wallet, 
  Clock, 
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatCurrency, formatDate, formatPeriode } from '@/lib/format';
import { exportToPDF, exportToExcel } from '@/lib/export';
import { toast } from 'sonner';
import type { IuranPembayaran, IuranTagihan, Anggota } from '@/types/database';

interface PembayaranWithDetails extends IuranPembayaran {
  tagihan?: IuranTagihan;
  kepala_keluarga?: Anggota;
}

interface KKOption {
  no_kk: string;
  nama_kk: string;
}

export default function RekapUangPage() {
  const { user, penagihWilayah } = useAuth();
  const [pembayaranList, setPembayaranList] = useState<PembayaranWithDetails[]>([]);
  const [kkOptions, setKkOptions] = useState<KKOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    tanggalMulai: '',
    tanggalAkhir: '',
    bulan: '',
    tahun: new Date().getFullYear().toString(),
    status: '',
    noKk: '',
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  const months = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
  ];

  const fetchData = useCallback(async () => {
    if (!user || penagihWilayah.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const rtRwPairs = penagihWilayah.map(w => ({ rt: w.rt, rw: w.rw }));
      
      const { data: anggotaData } = await supabase
        .from('anggota')
        .select('id, no_kk, rt, rw, nama_lengkap, hubungan_kk')
        .eq('status', 'aktif');
      
      const filteredAnggota = anggotaData?.filter(a => 
        rtRwPairs.some(pair => pair.rt === a.rt && pair.rw === a.rw)
      ) || [];

      const uniqueKKs = [...new Set(filteredAnggota.map(a => a.no_kk))];

      const kkOpts: KKOption[] = uniqueKKs.map(kk => {
        const kepala = filteredAnggota.find(a => a.no_kk === kk && a.hubungan_kk === 'Kepala Keluarga')
          || filteredAnggota.find(a => a.no_kk === kk);
        return { no_kk: kk, nama_kk: kepala?.nama_lengkap || kk };
      });
      setKkOptions(kkOpts);

      let query = supabase
        .from('iuran_pembayaran')
        .select('*, iuran_tagihan(*)')
        .eq('penagih_user_id', user.id)
        .order('tanggal_bayar', { ascending: false });

      if (filters.tanggalMulai) {
        query = query.gte('tanggal_bayar', filters.tanggalMulai);
      }
      if (filters.tanggalAkhir) {
        query = query.lte('tanggal_bayar', filters.tanggalAkhir + 'T23:59:59');
      }
      if (filters.status && (filters.status === 'menunggu_admin' || filters.status === 'disetujui' || filters.status === 'ditolak')) {
        query = query.eq('status', filters.status);
      }

      const { data: pembayaranData, error } = await query;

      if (error) {
        console.error('Error fetching pembayaran:', error);
        return;
      }

      let processedData: PembayaranWithDetails[] = (pembayaranData || []).map((p: any) => {
        const tagihan = p.iuran_tagihan as IuranTagihan;
        const kepala = tagihan ? filteredAnggota.find(a => 
          a.no_kk === tagihan.no_kk && a.hubungan_kk === 'Kepala Keluarga'
        ) || filteredAnggota.find(a => a.no_kk === tagihan.no_kk) : null;
        return {
          ...p,
          tagihan,
          kepala_keluarga: kepala as Anggota
        };
      });

      if (filters.bulan || filters.tahun) {
        processedData = processedData.filter(p => {
          if (!p.tagihan?.periode) return true;
          const [year, month] = p.tagihan.periode.split('-');
          if (filters.tahun && year !== filters.tahun) return false;
          if (filters.bulan && month !== filters.bulan) return false;
          return true;
        });
      }

      if (filters.noKk) {
        processedData = processedData.filter(p => p.tagihan?.no_kk === filters.noKk);
      }

      setPembayaranList(processedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, penagihWilayah, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetFilters = () => {
    setFilters({
      tanggalMulai: '',
      tanggalAkhir: '',
      bulan: '',
      tahun: new Date().getFullYear().toString(),
      status: '',
      noKk: '',
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'menunggu_admin': return 'Menunggu Verifikasi';
      case 'disetujui': return 'Disetujui';
      case 'ditolak': return 'Ditolak';
      default: return status;
    }
  };

  const totalSemua = pembayaranList.reduce((sum, p) => sum + p.nominal, 0);
  const totalDisetujui = pembayaranList.filter(p => p.status === 'disetujui').reduce((sum, p) => sum + p.nominal, 0);
  const totalMenunggu = pembayaranList.filter(p => p.status === 'menunggu_admin').reduce((sum, p) => sum + p.nominal, 0);

  const exportColumns = [
    { key: 'no', header: 'No' },
    { key: 'nama_kk', header: 'Nama KK' },
    { key: 'no_kk', header: 'No. KK' },
    { key: 'periode', header: 'Periode', format: (v: string) => v ? formatPeriode(v) : '-' },
    { key: 'tanggal_bayar', header: 'Tanggal Bayar', format: (v: string) => formatDate(v) },
    { key: 'nominal', header: 'Nominal', format: (v: number) => formatCurrency(v) },
    { key: 'metode', header: 'Metode' },
    { key: 'status', header: 'Status', format: (v: string) => getStatusLabel(v) },
  ];

  const getExportData = () => {
    return pembayaranList.map((p, idx) => ({
      no: idx + 1,
      nama_kk: p.kepala_keluarga?.nama_lengkap || '-',
      no_kk: p.tagihan?.no_kk || '-',
      periode: p.tagihan?.periode || '',
      tanggal_bayar: p.tanggal_bayar,
      nominal: p.nominal,
      metode: p.metode,
      status: p.status,
    }));
  };

  const handleExportPDF = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('Tidak ada data untuk di-export');
      return;
    }
    const wilayahText = penagihWilayah.map(w => `RT ${w.rt}/RW ${w.rw}`).join(', ');
    exportToPDF(data, exportColumns, `Rekap Uang Penagih - ${wilayahText}`, `rekap-uang-${new Date().toISOString().split('T')[0]}`);
    toast.success('Berhasil export ke PDF');
  };

  const handleExportExcel = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('Tidak ada data untuk di-export');
      return;
    }
    exportToExcel(data, exportColumns, 'Rekap Uang', `rekap-uang-${new Date().toISOString().split('T')[0]}`);
    toast.success('Berhasil export ke Excel');
  };

  if (loading) {
    return (
      <PenagihLayout title="Rekap Uang">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </PenagihLayout>
    );
  }

  return (
    <PenagihLayout title="Rekap Uang">
      <div className="space-y-4">
        {/* Header Card */}
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-purple-500/20">
                  <Wallet className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Rekap Uang</h2>
                  <p className="text-sm text-muted-foreground">{pembayaranList.length} pembayaran</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={pembayaranList.length === 0}>
                  <FileText className="h-4 w-4 mr-1" />
                  PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="bg-success/5 border-success/20">
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-5 w-5 text-success mx-auto" />
              <p className="text-sm font-bold text-success mt-1">{formatCurrency(totalDisetujui)}</p>
              <p className="text-[10px] text-muted-foreground">Disetujui</p>
            </CardContent>
          </Card>
          <Card className="bg-warning/5 border-warning/20">
            <CardContent className="p-3 text-center">
              <Clock className="h-5 w-5 text-warning mx-auto" />
              <p className="text-sm font-bold text-warning mt-1">{formatCurrency(totalMenunggu)}</p>
              <p className="text-[10px] text-muted-foreground">Menunggu</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/50">
            <CardContent className="p-3 text-center">
              <Receipt className="h-5 w-5 text-muted-foreground mx-auto" />
              <p className="text-sm font-bold mt-1">{formatCurrency(totalSemua)}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="py-3">
            <Button 
              variant="ghost" 
              className="w-full flex items-center justify-between p-0 h-auto"
              onClick={() => setShowFilters(!showFilters)}
            >
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter Data
              </CardTitle>
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardHeader>
          {showFilters && (
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tanggal Mulai</Label>
                  <Input
                    type="date"
                    value={filters.tanggalMulai}
                    onChange={(e) => setFilters({ ...filters, tanggalMulai: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tanggal Akhir</Label>
                  <Input
                    type="date"
                    value={filters.tanggalAkhir}
                    onChange={(e) => setFilters({ ...filters, tanggalAkhir: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bulan</Label>
                  <Select value={filters.bulan || "all"} onValueChange={(v) => setFilters({ ...filters, bulan: v === "all" ? "" : v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Semua" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Bulan</SelectItem>
                      {months.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tahun</Label>
                  <Select value={filters.tahun || "all"} onValueChange={(v) => setFilters({ ...filters, tahun: v === "all" ? "" : v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Semua" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Tahun</SelectItem>
                      {years.map(y => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ ...filters, status: v === "all" ? "" : v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Semua" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="menunggu_admin">Menunggu</SelectItem>
                      <SelectItem value="disetujui">Disetujui</SelectItem>
                      <SelectItem value="ditolak">Ditolak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kepala KK</Label>
                  <Select value={filters.noKk || "all"} onValueChange={(v) => setFilters({ ...filters, noKk: v === "all" ? "" : v })}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Semua" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua KK</SelectItem>
                      {kkOptions.map(kk => (
                        <SelectItem key={kk.no_kk} value={kk.no_kk}>{kk.nama_kk}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={resetFilters} className="w-full">
                <X className="h-4 w-4 mr-1" />
                Reset Filter
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Pembayaran List */}
        <div className="space-y-3">
          {pembayaranList.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Tidak Ada Data"
              description="Tidak ada data pembayaran yang sesuai dengan filter."
            />
          ) : (
            pembayaranList.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                        <Receipt className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{item.kepala_keluarga?.nama_lengkap || '-'}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.tagihan ? formatPeriode(item.tagihan.periode) : '-'}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(item.tanggal_bayar)}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-bold text-primary">{formatCurrency(item.nominal)}</p>
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </PenagihLayout>
  );
}
