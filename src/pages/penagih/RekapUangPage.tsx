import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { ExportButtons } from '@/components/ui/export-buttons';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Receipt, Filter, X, TrendingUp } from 'lucide-react';
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

  // Filter states
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
      
      // Get anggota in penagih wilayah
      const { data: anggotaData } = await supabase
        .from('anggota')
        .select('id, no_kk, rt, rw, nama_lengkap, hubungan_kk')
        .eq('status', 'aktif');
      
      const filteredAnggota = anggotaData?.filter(a => 
        rtRwPairs.some(pair => pair.rt === a.rt && pair.rw === a.rw)
      ) || [];

      const uniqueKKs = [...new Set(filteredAnggota.map(a => a.no_kk))];

      // Build KK options
      const kkOpts: KKOption[] = uniqueKKs.map(kk => {
        const kepala = filteredAnggota.find(a => a.no_kk === kk && a.hubungan_kk === 'Kepala Keluarga')
          || filteredAnggota.find(a => a.no_kk === kk);
        return { no_kk: kk, nama_kk: kepala?.nama_lengkap || kk };
      });
      setKkOptions(kkOpts);

      // Fetch pembayaran by this penagih
      let query = supabase
        .from('iuran_pembayaran')
        .select('*, iuran_tagihan(*)')
        .eq('penagih_user_id', user.id)
        .order('tanggal_bayar', { ascending: false });

      // Apply filters
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

      // Process and filter data
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

      // Filter by bulan & tahun (from periode)
      if (filters.bulan || filters.tahun) {
        processedData = processedData.filter(p => {
          if (!p.tagihan?.periode) return true;
          const [year, month] = p.tagihan.periode.split('-');
          if (filters.tahun && year !== filters.tahun) return false;
          if (filters.bulan && month !== filters.bulan) return false;
          return true;
        });
      }

      // Filter by KK
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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'menunggu_admin': return 'warning';
      case 'disetujui': return 'success';
      case 'ditolak': return 'destructive';
      default: return 'secondary';
    }
  };

  // Calculate totals
  const totalSemua = pembayaranList.reduce((sum, p) => sum + p.nominal, 0);
  const totalDisetujui = pembayaranList.filter(p => p.status === 'disetujui').reduce((sum, p) => sum + p.nominal, 0);
  const totalMenunggu = pembayaranList.filter(p => p.status === 'menunggu_admin').reduce((sum, p) => sum + p.nominal, 0);

  // Export functions
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

  const columns = [
    {
      key: 'nama_kk',
      header: 'Nama KK',
      cell: (item: PembayaranWithDetails) => (
        <div>
          <p className="font-medium text-sm">{item.kepala_keluarga?.nama_lengkap || '-'}</p>
          <p className="text-xs text-muted-foreground">KK: {item.tagihan?.no_kk || '-'}</p>
        </div>
      ),
    },
    {
      key: 'periode',
      header: 'Periode',
      cell: (item: PembayaranWithDetails) => item.tagihan?.periode ? formatPeriode(item.tagihan.periode) : '-',
      className: 'hidden sm:table-cell',
    },
    {
      key: 'tanggal_bayar',
      header: 'Tanggal Bayar',
      cell: (item: PembayaranWithDetails) => formatDate(item.tanggal_bayar),
      className: 'hidden md:table-cell',
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: PembayaranWithDetails) => (
        <span className="font-medium">{formatCurrency(item.nominal)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: PembayaranWithDetails) => (
        <StatusBadge 
          status={getStatusLabel(item.status)} 
          variant={getStatusVariant(item.status) as any} 
        />
      ),
    },
  ];

  if (loading) {
    return (
      <PenagihLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </PenagihLayout>
    );
  }

  return (
    <PenagihLayout>
      <PageHeader 
        title="Rekap Uang" 
        description="Rekap pembayaran yang Anda input"
      >
        <ExportButtons 
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          disabled={pembayaranList.length === 0}
        />
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Disetujui</p>
                <p className="text-xl font-bold text-success">{formatCurrency(totalDisetujui)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Receipt className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Menunggu Verifikasi</p>
                <p className="text-xl font-bold text-warning">{formatCurrency(totalMenunggu)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Receipt className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Semua</p>
                <p className="text-xl font-bold">{formatCurrency(totalSemua)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter Data
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetFilters}>
                <X className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
                {showFilters ? 'Sembunyikan' : 'Tampilkan'}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Mulai</Label>
                <Input
                  type="date"
                  value={filters.tanggalMulai}
                  onChange={(e) => setFilters({ ...filters, tanggalMulai: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Akhir</Label>
                <Input
                  type="date"
                  value={filters.tanggalAkhir}
                  onChange={(e) => setFilters({ ...filters, tanggalAkhir: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bulan Periode</Label>
                <Select value={filters.bulan || "all"} onValueChange={(v) => setFilters({ ...filters, bulan: v === "all" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Bulan</SelectItem>
                    {months.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tahun Periode</Label>
                <Select value={filters.tahun || "all"} onValueChange={(v) => setFilters({ ...filters, tahun: v === "all" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Tahun</SelectItem>
                    {years.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filters.status || "all"} onValueChange={(v) => setFilters({ ...filters, status: v === "all" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="menunggu_admin">Menunggu Verifikasi</SelectItem>
                    <SelectItem value="disetujui">Disetujui</SelectItem>
                    <SelectItem value="ditolak">Ditolak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kepala Keluarga</Label>
                <Select value={filters.noKk || "all"} onValueChange={(v) => setFilters({ ...filters, noKk: v === "all" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua KK" />
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
          </CardContent>
        )}
      </Card>

      {/* Data Table */}
      {pembayaranList.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Tidak Ada Data"
          description="Tidak ada data pembayaran yang sesuai dengan filter."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Daftar Pembayaran ({pembayaranList.length} data)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable columns={columns} data={pembayaranList} />
          </CardContent>
        </Card>
      )}
    </PenagihLayout>
  );
}
