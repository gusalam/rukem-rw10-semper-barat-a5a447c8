import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { StatCard } from '@/components/ui/stat-card';
import { ExportButtons } from '@/components/ui/export-buttons';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Receipt, Wallet, HandHeart, Home, ChevronDown, ChevronRight, Filter, BarChart3, FileText } from 'lucide-react';
import type { Anggota, IuranTagihan, IuranPembayaran, Kas, Santunan } from '@/types/database';
import { formatCurrency, formatDate, formatPeriode } from '@/lib/format';
import { exportToPDF, exportToExcel } from '@/lib/export';
import { cn } from '@/lib/utils';
import { RekapBulanan } from '@/components/admin/RekapBulanan';

interface KKTagihanReport {
  no_kk: string;
  kepala_keluarga: string;
  anggota_list: Anggota[];
  tagihan_list: IuranTagihan[];
  total_tagihan: number;
  total_lunas: number;
  total_belum_bayar: number;
}

export default function LaporanPage() {
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [tagihanList, setTagihanList] = useState<IuranTagihan[]>([]);
  const [pembayaranList, setPembayaranList] = useState<IuranPembayaran[]>([]);
  const [kasList, setKasList] = useState<Kas[]>([]);
  const [santunanList, setSantunanList] = useState<Santunan[]>([]);
  const [kkTagihanReport, setKkTagihanReport] = useState<KKTagihanReport[]>([]);
  const [expandedKK, setExpandedKK] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedPeriode, setSelectedPeriode] = useState<string>('all');
  const [selectedStatusAnggota, setSelectedStatusAnggota] = useState<string>('all');
  
  // State untuk COUNT langsung dari database (tidak terbatas limit 1000)
  const [countStats, setCountStats] = useState({
    totalAnggota: 0,
    anggotaAktif: 0,
    anggotaNonaktif: 0,
    anggotaMeninggal: 0,
    kkValid: 0,
    totalKK: 0,
  });

  // Generate available periods from tagihan data
  const availablePeriodes = useMemo(() => {
    const periodes = new Set<string>();
    tagihanList.forEach(t => periodes.add(t.periode));
    return Array.from(periodes).sort().reverse();
  }, [tagihanList]);

  // Filter KK Tagihan Report by selected period
  const filteredKkTagihanReport = useMemo(() => {
    if (selectedPeriode === 'all') return kkTagihanReport;
    
    return kkTagihanReport.map(kk => {
      const filteredTagihan = kk.tagihan_list.filter(t => t.periode === selectedPeriode);
      const total_tagihan = filteredTagihan.reduce((sum, t) => sum + t.nominal, 0);
      const total_lunas = filteredTagihan.filter(t => t.status === 'lunas').reduce((sum, t) => sum + t.nominal, 0);
      const total_belum_bayar = filteredTagihan.filter(t => t.status === 'belum_bayar').reduce((sum, t) => sum + t.nominal, 0);
      
      return {
        ...kk,
        tagihan_list: filteredTagihan,
        total_tagihan,
        total_lunas,
        total_belum_bayar,
      };
    }).filter(kk => kk.tagihan_list.length > 0);
  }, [kkTagihanReport, selectedPeriode]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // === QUERY COUNT LANGSUNG DARI DATABASE (tidak terbatas limit 1000) ===
      const [
        totalAnggotaRes,
        anggotaAktifRes,
        anggotaNonaktifRes,
        anggotaMeninggalRes,
        kkValidRes,
        anggotaRes, 
        tagihanRes, 
        pembayaranRes, 
        kasRes, 
        santunanRes
      ] = await Promise.all([
        supabase.from('anggota').select('*', { count: 'exact', head: true }),
        supabase.from('anggota').select('*', { count: 'exact', head: true }).eq('status', 'aktif'),
        supabase.from('anggota').select('*', { count: 'exact', head: true }).eq('status', 'nonaktif'),
        supabase.from('anggota').select('*', { count: 'exact', head: true }).eq('status', 'meninggal'),
        // KK Valid = count anggota aktif yang status_dalam_kk = 'kepala_keluarga'
        supabase.from('anggota').select('no_kk', { count: 'exact', head: true }).eq('status', 'aktif').eq('status_dalam_kk', 'kepala_keluarga'),
        supabase.from('anggota').select('*').order('nama_lengkap'),
        supabase.from('iuran_tagihan').select('*').order('jatuh_tempo', { ascending: false }),
        supabase.from('iuran_pembayaran').select('*, tagihan:iuran_tagihan(*)').order('created_at', { ascending: false }),
        supabase.from('kas').select('*').order('created_at', { ascending: false }),
        supabase.from('santunan').select('*, anggota(*), kematian(*)').order('created_at', { ascending: false }),
      ]);

      // Hitung total KK unik dari anggota aktif (dengan batch fetching)
      let allKKs: string[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: kkBatch } = await supabase
          .from('anggota')
          .select('no_kk')
          .eq('status', 'aktif')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (kkBatch && kkBatch.length > 0) {
          allKKs = allKKs.concat(kkBatch.map(a => a.no_kk));
          hasMore = kkBatch.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      const uniqueKK = new Set(allKKs);
      const totalKK = uniqueKK.size;
      const kkValid = kkValidRes.count || 0;

      // Set count stats dari database (akurat, tidak terbatas limit)
      setCountStats({
        totalAnggota: totalAnggotaRes.count || 0,
        anggotaAktif: anggotaAktifRes.count || 0,
        anggotaNonaktif: anggotaNonaktifRes.count || 0,
        anggotaMeninggal: anggotaMeninggalRes.count || 0,
        kkValid,
        totalKK,
      });

      const anggota = anggotaRes.data as Anggota[] || [];
      const tagihan = tagihanRes.data as IuranTagihan[] || [];

      // PENTING: Filter hanya anggota aktif untuk perhitungan KK
      const anggotaAktif = anggota.filter(a => a.status === 'aktif');

      setAnggotaList(anggota);
      setTagihanList(tagihan);
      setPembayaranList(pembayaranRes.data as IuranPembayaran[] || []);
      setKasList(kasRes.data as Kas[] || []);
      setSantunanList(santunanRes.data as Santunan[] || []);

      // Build KK Tagihan Report - HANYA dari anggota aktif
      const kkMap = new Map<string, KKTagihanReport>();
      
      anggotaAktif.forEach(a => {
        if (!kkMap.has(a.no_kk)) {
          kkMap.set(a.no_kk, {
            no_kk: a.no_kk,
            kepala_keluarga: '',
            anggota_list: [],
            tagihan_list: [],
            total_tagihan: 0,
            total_lunas: 0,
            total_belum_bayar: 0,
          });
        }
        const kk = kkMap.get(a.no_kk)!;
        kk.anggota_list.push(a);
        if (a.status_dalam_kk === 'kepala_keluarga') {
          kk.kepala_keluarga = a.nama_lengkap;
        }
      });

      // Assign tagihan to KK
      tagihan.forEach(t => {
        if (kkMap.has(t.no_kk)) {
          const kk = kkMap.get(t.no_kk)!;
          kk.tagihan_list.push(t);
          kk.total_tagihan += t.nominal;
          if (t.status === 'lunas') {
            kk.total_lunas += t.nominal;
          } else if (t.status === 'belum_bayar') {
            kk.total_belum_bayar += t.nominal;
          }
        }
      });

      // Set default kepala_keluarga if not found
      kkMap.forEach(kk => {
        if (!kk.kepala_keluarga && kk.anggota_list.length > 0) {
          kk.kepala_keluarga = kk.anggota_list[0].nama_lengkap;
        }
      });

      setKkTagihanReport(Array.from(kkMap.values()).sort((a, b) => a.kepala_keluarga.localeCompare(b.kepala_keluarga)));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleKKExpand = (noKK: string) => {
    setExpandedKK(prev => {
      const next = new Set(prev);
      if (next.has(noKK)) {
        next.delete(noKK);
      } else {
        next.add(noKK);
      }
      return next;
    });
  };

  // PENTING: Gunakan countStats dari database untuk statistik (akurat, tidak terbatas limit 1000)
  const totalTagihanLunas = tagihanList.filter(t => t.status === 'lunas').length;
  const saldoKas = kasList.reduce((acc, k) => acc + (k.jenis === 'pemasukan' ? k.nominal : -k.nominal), 0);
  const totalSantunanDisalurkan = santunanList.filter(s => s.status === 'disalurkan').reduce((acc, s) => acc + s.nominal_akhir, 0);

  // Hitung KK Tanpa Kepala dari countStats
  const kkTanpaKepala = countStats.totalKK - countStats.kkValid;

  // Export configurations
  const anggotaExportColumns = [
    { key: 'nama_lengkap', header: 'Nama' },
    { key: 'nik', header: 'NIK' },
    { key: 'no_hp', header: 'No HP' },
    { key: 'alamat', header: 'Alamat' },
    { key: 'status', header: 'Status' },
    { key: 'tanggal_bergabung', header: 'Bergabung', format: (v: string) => formatDate(v) },
  ];

  const tagihanExportColumns = [
    { key: 'no_kk', header: 'No. KK' },
    { key: 'kepala', header: 'Kepala Keluarga', format: (_: any, row: IuranTagihan) => row.kepala_keluarga?.nama_lengkap || '-' },
    { key: 'periode', header: 'Periode', format: (v: string) => formatPeriode(v) },
    { key: 'nominal', header: 'Nominal', format: (v: number) => formatCurrency(v) },
    { key: 'status', header: 'Status' },
    { key: 'jatuh_tempo', header: 'Jatuh Tempo', format: (v: string) => formatDate(v) },
  ];

  const kkTagihanExportColumns = [
    { key: 'no_kk', header: 'No. KK' },
    { key: 'kepala_keluarga', header: 'Kepala Keluarga' },
    { key: 'anggota_count', header: 'Jml Anggota', format: (_: any, row: KKTagihanReport) => row.anggota_list.length.toString() },
    { key: 'total_tagihan', header: 'Total Tagihan', format: (v: number) => formatCurrency(v) },
    { key: 'total_lunas', header: 'Total Lunas', format: (v: number) => formatCurrency(v) },
    { key: 'total_belum_bayar', header: 'Belum Bayar', format: (v: number) => formatCurrency(v) },
  ];

  const kasExportColumns = [
    { key: 'created_at', header: 'Tanggal', format: (v: string) => formatDate(v) },
    { key: 'keterangan', header: 'Keterangan' },
    { key: 'jenis', header: 'Jenis', format: (v: string) => v === 'pemasukan' ? 'Masuk' : 'Keluar' },
    { key: 'nominal', header: 'Nominal', format: (v: number) => formatCurrency(v) },
  ];

  const santunanExportColumns = [
    { key: 'anggota', header: 'Almarhum', format: (_: any, row: Santunan) => row.anggota?.nama_lengkap || '-' },
    { key: 'nominal_dasar', header: 'Nominal Dasar', format: (v: number) => formatCurrency(v) },
    { key: 'potongan_tunggakan', header: 'Potongan', format: (v: number) => formatCurrency(v) },
    { key: 'nominal_akhir', header: 'Nominal Akhir', format: (v: number) => formatCurrency(v) },
    { key: 'status', header: 'Status' },
    { key: 'tanggal_penyaluran', header: 'Tgl Penyaluran', format: (v: string) => v ? formatDate(v) : '-' },
  ];

  const anggotaColumns = [
    { key: 'nama_lengkap', header: 'Nama' },
    { key: 'nik', header: 'NIK', className: 'hidden md:table-cell' },
    { key: 'no_hp', header: 'No HP', className: 'hidden md:table-cell' },
    {
      key: 'status',
      header: 'Status',
      cell: (item: Anggota) => <StatusBadge status={item.status} />,
    },
    {
      key: 'tanggal_bergabung',
      header: 'Bergabung',
      cell: (item: Anggota) => formatDate(item.tanggal_bergabung),
      className: 'hidden md:table-cell',
    },
  ];

  const tagihanColumns = [
    {
      key: 'no_kk',
      header: 'No. KK',
      cell: (item: IuranTagihan) => (
        <div>
          <p className="font-medium">{item.no_kk}</p>
          <p className="text-xs text-muted-foreground">{item.kepala_keluarga?.nama_lengkap}</p>
        </div>
      ),
    },
    {
      key: 'periode',
      header: 'Periode',
      cell: (item: IuranTagihan) => formatPeriode(item.periode),
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: IuranTagihan) => formatCurrency(item.nominal),
      className: 'hidden md:table-cell',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: IuranTagihan) => <StatusBadge status={item.status} />,
    },
  ];

  const kasColumns = [
    {
      key: 'created_at',
      header: 'Tanggal',
      cell: (item: Kas) => formatDate(item.created_at),
    },
    { key: 'keterangan', header: 'Keterangan' },
    {
      key: 'jenis',
      header: 'Jenis',
      cell: (item: Kas) => (
        <span className={item.jenis === 'pemasukan' ? 'text-success' : 'text-destructive'}>
          {item.jenis === 'pemasukan' ? 'Masuk' : 'Keluar'}
        </span>
      ),
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: Kas) => formatCurrency(item.nominal),
    },
  ];

  const santunanColumns = [
    {
      key: 'anggota',
      header: 'Almarhum',
      cell: (item: Santunan) => item.anggota?.nama_lengkap || '-',
    },
    {
      key: 'nominal_akhir',
      header: 'Nominal',
      cell: (item: Santunan) => formatCurrency(item.nominal_akhir),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: Santunan) => <StatusBadge status={item.status} />,
    },
    {
      key: 'tanggal_penyaluran',
      header: 'Tgl Penyaluran',
      cell: (item: Santunan) => item.tanggal_penyaluran ? formatDate(item.tanggal_penyaluran) : '-',
      className: 'hidden md:table-cell',
    },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  // Map tagihan with kepala keluarga for table display (menggunakan status_dalam_kk)
  const tagihanWithKK = tagihanList.map(t => {
    const kepala = anggotaList.find(
      a => a.no_kk === t.no_kk && a.status_dalam_kk === 'kepala_keluarga'
    ) || anggotaList.find(a => a.no_kk === t.no_kk);
    return { ...t, kepala_keluarga: kepala };
  });

  return (
    <AdminLayout>
      <PageHeader title="Laporan" description="Lihat dan cetak laporan RUKEM" />

      <div className="grid gap-4 md:grid-cols-6 mt-6">
        <StatCard
          title="Total Anggota"
          value={countStats.totalAnggota}
          icon={Users}
          description={`${countStats.anggotaAktif} aktif`}
          tooltip="Jumlah semua anggota terdaftar di sistem RUKEM"
        />
        <StatCard
          title="Anggota Aktif"
          value={countStats.anggotaAktif}
          icon={Users}
          tooltip="Anggota dengan status aktif yang bisa mengikuti iuran"
          iconClassName="bg-success/10"
        />
        <StatCard
          title="KK Aktif (Valid)"
          value={countStats.kkValid}
          icon={Home}
          description="Dapat mengikuti iuran"
          tooltip="KK yang memiliki Kepala Keluarga terdaftar. Hanya KK ini yang bisa mengikuti iuran dan santunan."
          iconClassName="bg-primary/10"
        />
        {kkTanpaKepala > 0 && (
          <StatCard
            title="KK Tanpa Kepala"
            value={kkTanpaKepala}
            icon={Home}
            description="Belum bisa ikut iuran"
            tooltip="KK ini belum memiliki Kepala Keluarga. Perlu ditambahkan agar bisa mengikuti iuran."
            iconClassName="bg-warning/10"
            variant="warning"
          />
        )}
        <StatCard
          title="Tagihan Lunas"
          value={totalTagihanLunas}
          icon={Receipt}
          tooltip="Total tagihan yang sudah dibayar dan diverifikasi"
          iconClassName="bg-success/10"
        />
        <StatCard
          title="Saldo Kas"
          value={formatCurrency(saldoKas)}
          icon={Wallet}
          tooltip="Total saldo kas RUKEM saat ini"
          iconClassName="bg-info/10"
        />
        <StatCard
          title="Total Santunan"
          value={formatCurrency(totalSantunanDisalurkan)}
          icon={HandHeart}
          tooltip="Total santunan yang sudah disalurkan ke ahli waris"
          iconClassName="bg-warning/10"
        />
      </div>

      <Tabs defaultValue="rekap" className="mt-6">
        {/* Mobile: Grid quick action boxes */}
        <TabsList className="grid grid-cols-3 gap-2 h-auto p-0 bg-transparent md:hidden">
          <TabsTrigger 
            value="rekap" 
            className="flex flex-col items-center justify-center gap-1.5 p-3 h-auto rounded-xl border border-border bg-card data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary shadow-sm transition-all"
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-xs font-medium">Rekap</span>
          </TabsTrigger>
          <TabsTrigger 
            value="tagihan-kk" 
            className="flex flex-col items-center justify-center gap-1.5 p-3 h-auto rounded-xl border border-border bg-card data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary shadow-sm transition-all"
          >
            <Home className="h-5 w-5" />
            <span className="text-xs font-medium">Per KK</span>
          </TabsTrigger>
          <TabsTrigger 
            value="anggota" 
            className="flex flex-col items-center justify-center gap-1.5 p-3 h-auto rounded-xl border border-border bg-card data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary shadow-sm transition-all"
          >
            <Users className="h-5 w-5" />
            <span className="text-xs font-medium">Anggota</span>
          </TabsTrigger>
          <TabsTrigger 
            value="tagihan" 
            className="flex flex-col items-center justify-center gap-1.5 p-3 h-auto rounded-xl border border-border bg-card data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary shadow-sm transition-all"
          >
            <FileText className="h-5 w-5" />
            <span className="text-xs font-medium">Tagihan</span>
          </TabsTrigger>
          <TabsTrigger 
            value="kas" 
            className="flex flex-col items-center justify-center gap-1.5 p-3 h-auto rounded-xl border border-border bg-card data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary shadow-sm transition-all"
          >
            <Wallet className="h-5 w-5" />
            <span className="text-xs font-medium">Kas</span>
          </TabsTrigger>
          <TabsTrigger 
            value="santunan" 
            className="flex flex-col items-center justify-center gap-1.5 p-3 h-auto rounded-xl border border-border bg-card data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary shadow-sm transition-all"
          >
            <HandHeart className="h-5 w-5" />
            <span className="text-xs font-medium">Santunan</span>
          </TabsTrigger>
        </TabsList>

        {/* Desktop: Horizontal tabs */}
        <TabsList className="hidden md:inline-flex h-auto p-1 gap-1 bg-muted/50 rounded-lg">
          <TabsTrigger value="rekap" className="px-4 py-2 text-sm">Rekap</TabsTrigger>
          <TabsTrigger value="tagihan-kk" className="px-4 py-2 text-sm">Per KK</TabsTrigger>
          <TabsTrigger value="anggota" className="px-4 py-2 text-sm">Anggota</TabsTrigger>
          <TabsTrigger value="tagihan" className="px-4 py-2 text-sm">Tagihan</TabsTrigger>
          <TabsTrigger value="kas" className="px-4 py-2 text-sm">Kas</TabsTrigger>
          <TabsTrigger value="santunan" className="px-4 py-2 text-sm">Santunan</TabsTrigger>
        </TabsList>

        <TabsContent value="rekap" className="mt-4">
          <RekapBulanan 
            tagihanList={tagihanList} 
            pembayaranList={pembayaranList}
            kasList={kasList}
          />
        </TabsContent>

        <TabsContent value="tagihan-kk" className="mt-4">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-base">Laporan Tagihan per Kartu Keluarga</CardTitle>
                <ExportButtons
                  onExportPDF={() => exportToPDF(filteredKkTagihanReport, kkTagihanExportColumns, `Laporan Tagihan per KK RUKEM${selectedPeriode !== 'all' ? ` - ${formatPeriode(selectedPeriode)}` : ''}`, 'laporan-tagihan-kk')}
                  onExportExcel={() => exportToExcel(filteredKkTagihanReport, kkTagihanExportColumns, 'Tagihan per KK', 'laporan-tagihan-kk')}
                  disabled={filteredKkTagihanReport.length === 0}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedPeriode} onValueChange={setSelectedPeriode}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Pilih periode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Periode</SelectItem>
                    {availablePeriodes.map((periode) => (
                      <SelectItem key={periode} value={periode}>
                        {formatPeriode(periode)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPeriode !== 'all' && (
                  <Badge variant="secondary" className="ml-2">
                    {filteredKkTagihanReport.length} KK
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredKkTagihanReport.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {selectedPeriode === 'all' ? 'Belum ada data tagihan' : `Tidak ada data tagihan untuk periode ${formatPeriode(selectedPeriode)}`}
                </p>
              ) : (
              <div className="space-y-2">
                {filteredKkTagihanReport.map((kk) => {
                  const isExpanded = expandedKK.has(kk.no_kk);
                  const lunasCount = kk.tagihan_list.filter(t => t.status === 'lunas').length;
                  const totalCount = kk.tagihan_list.length;
                  
                  return (
                    <div key={kk.no_kk} className="border rounded-lg overflow-hidden">
                      {/* KK Header */}
                      <div 
                        className="flex items-center justify-between p-4 bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => toggleKKExpand(kk.no_kk)}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <p className="font-medium">{kk.kepala_keluarga}</p>
                            <p className="text-xs text-muted-foreground">KK: {kk.no_kk}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className="hidden sm:flex">
                            {kk.anggota_list.length} anggota
                          </Badge>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {lunasCount}/{totalCount} lunas
                            </p>
                            {kk.total_belum_bayar > 0 && (
                              <p className="text-xs text-destructive">
                                Tunggakan: {formatCurrency(kk.total_belum_bayar)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="p-4 border-t bg-background">
                          {/* Family Members */}
                          <div className="mb-4">
                            <p className="text-sm font-medium mb-2">Anggota Keluarga:</p>
                            <div className="flex flex-wrap gap-2">
                              {kk.anggota_list.map((member) => (
                                <div 
                                  key={member.id} 
                                  className={cn(
                                    "px-3 py-1 rounded-full text-sm border",
                                    member.hubungan_kk === 'Kepala Keluarga' 
                                      ? "bg-primary/10 border-primary/30" 
                                      : "bg-muted"
                                  )}
                                >
                                  {member.nama_lengkap}
                                  {member.hubungan_kk && (
                                    <span className="ml-1 text-xs text-muted-foreground">
                                      ({member.hubungan_kk})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Tagihan History */}
                          <div>
                            <p className="text-sm font-medium mb-2">Riwayat Tagihan:</p>
                            {kk.tagihan_list.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Belum ada data tagihan</p>
                            ) : (
                              <div className="space-y-2">
                                {kk.tagihan_list.slice(0, 6).map((tagihan) => (
                                  <div 
                                    key={tagihan.id} 
                                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                                  >
                                    <div>
                                      <p className="font-medium">{formatPeriode(tagihan.periode)}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Jatuh tempo: {formatDate(tagihan.jatuh_tempo)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <p className="font-medium">{formatCurrency(tagihan.nominal)}</p>
                                      <StatusBadge status={tagihan.status} />
                                    </div>
                                  </div>
                                ))}
                                {kk.tagihan_list.length > 6 && (
                                  <p className="text-sm text-muted-foreground text-center py-2">
                                    +{kk.tagihan_list.length - 6} tagihan lainnya
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Summary */}
                          <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-xs text-muted-foreground">Total Tagihan</p>
                              <p className="font-bold">{formatCurrency(kk.total_tagihan)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Sudah Dibayar</p>
                              <p className="font-bold text-success">{formatCurrency(kk.total_lunas)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Belum Dibayar</p>
                              <p className="font-bold text-destructive">{formatCurrency(kk.total_belum_bayar)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anggota" className="mt-4">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-base">Laporan Anggota</CardTitle>
                <ExportButtons
                  onExportPDF={() => exportToPDF(
                    selectedStatusAnggota === 'all' ? anggotaList : anggotaList.filter(a => a.status === selectedStatusAnggota), 
                    anggotaExportColumns, 
                    `Laporan Data Anggota RUKEM${selectedStatusAnggota !== 'all' ? ` (${selectedStatusAnggota})` : ''}`, 
                    'laporan-anggota'
                  )}
                  onExportExcel={() => exportToExcel(
                    selectedStatusAnggota === 'all' ? anggotaList : anggotaList.filter(a => a.status === selectedStatusAnggota), 
                    anggotaExportColumns, 
                    'Anggota', 
                    'laporan-anggota'
                  )}
                  disabled={anggotaList.length === 0}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedStatusAnggota} onValueChange={setSelectedStatusAnggota}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="nonaktif">Nonaktif</SelectItem>
                    <SelectItem value="meninggal">Meninggal</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {selectedStatusAnggota === 'all' 
                      ? countStats.totalAnggota 
                      : selectedStatusAnggota === 'aktif' 
                        ? countStats.anggotaAktif 
                        : selectedStatusAnggota === 'nonaktif'
                          ? countStats.anggotaNonaktif
                          : countStats.anggotaMeninggal} data
                  </Badge>
                  {selectedStatusAnggota === 'all' && (
                    <span className="text-xs text-muted-foreground">
                      ({countStats.anggotaAktif} aktif, {countStats.anggotaNonaktif} nonaktif, {countStats.anggotaMeninggal} meninggal)
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Gunakan filter untuk melihat data per status. Total Anggota = semua data, Anggota Aktif = status aktif.
              </p>
            </CardHeader>
            <CardContent>
              <DataTable 
                columns={anggotaColumns} 
                data={selectedStatusAnggota === 'all' ? anggotaList : anggotaList.filter(a => a.status === selectedStatusAnggota)} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tagihan" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Laporan Tagihan</CardTitle>
              <ExportButtons
                onExportPDF={() => exportToPDF(tagihanWithKK, tagihanExportColumns, 'Laporan Data Tagihan RUKEM', 'laporan-tagihan')}
                onExportExcel={() => exportToExcel(tagihanWithKK, tagihanExportColumns, 'Tagihan', 'laporan-tagihan')}
                disabled={tagihanList.length === 0}
              />
            </CardHeader>
            <CardContent>
              <DataTable columns={tagihanColumns} data={tagihanWithKK} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kas" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Laporan Kas</CardTitle>
              <ExportButtons
                onExportPDF={() => exportToPDF(kasList, kasExportColumns, 'Laporan Kas RUKEM', 'laporan-kas')}
                onExportExcel={() => exportToExcel(kasList, kasExportColumns, 'Kas', 'laporan-kas')}
                disabled={kasList.length === 0}
              />
            </CardHeader>
            <CardContent>
              <DataTable columns={kasColumns} data={kasList} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="santunan" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Laporan Santunan</CardTitle>
              <ExportButtons
                onExportPDF={() => exportToPDF(santunanList, santunanExportColumns, 'Laporan Santunan RUKEM', 'laporan-santunan')}
                onExportExcel={() => exportToExcel(santunanList, santunanExportColumns, 'Santunan', 'laporan-santunan')}
                disabled={santunanList.length === 0}
              />
            </CardHeader>
            <CardContent>
              <DataTable columns={santunanColumns} data={santunanList} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
