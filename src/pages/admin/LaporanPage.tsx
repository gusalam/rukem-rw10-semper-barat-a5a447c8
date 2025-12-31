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
import { Users, Receipt, Wallet, HandHeart, Home, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import type { Anggota, Iuran, Kas, Santunan } from '@/types/database';
import { formatCurrency, formatDate, formatPeriode } from '@/lib/format';
import { exportToPDF, exportToExcel } from '@/lib/export';
import { cn } from '@/lib/utils';

interface KKIuranReport {
  no_kk: string;
  kepala_keluarga: string;
  anggota_list: Anggota[];
  iuran_list: Iuran[];
  total_iuran: number;
  total_lunas: number;
  total_belum_bayar: number;
}

export default function LaporanPage() {
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [iuranList, setIuranList] = useState<Iuran[]>([]);
  const [kasList, setKasList] = useState<Kas[]>([]);
  const [santunanList, setSantunanList] = useState<Santunan[]>([]);
  const [kkIuranReport, setKkIuranReport] = useState<KKIuranReport[]>([]);
  const [expandedKK, setExpandedKK] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedPeriode, setSelectedPeriode] = useState<string>('all');

  // Generate available periods from iuran data
  const availablePeriodes = useMemo(() => {
    const periodes = new Set<string>();
    iuranList.forEach(i => periodes.add(i.periode));
    return Array.from(periodes).sort().reverse();
  }, [iuranList]);

  // Filter KK Iuran Report by selected period
  const filteredKkIuranReport = useMemo(() => {
    if (selectedPeriode === 'all') return kkIuranReport;
    
    return kkIuranReport.map(kk => {
      const filteredIuran = kk.iuran_list.filter(i => i.periode === selectedPeriode);
      const total_iuran = filteredIuran.reduce((sum, i) => sum + i.nominal, 0);
      const total_lunas = filteredIuran.filter(i => i.status === 'lunas').reduce((sum, i) => sum + i.nominal, 0);
      const total_belum_bayar = filteredIuran.filter(i => i.status === 'belum_bayar' || i.status === 'ditolak').reduce((sum, i) => sum + i.nominal, 0);
      
      return {
        ...kk,
        iuran_list: filteredIuran,
        total_iuran,
        total_lunas,
        total_belum_bayar,
      };
    }).filter(kk => kk.iuran_list.length > 0);
  }, [kkIuranReport, selectedPeriode]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [anggotaRes, iuranRes, kasRes, santunanRes] = await Promise.all([
        supabase.from('anggota').select('*').order('nama_lengkap'),
        supabase.from('iuran').select('*, anggota(*)').order('jatuh_tempo', { ascending: false }),
        supabase.from('kas').select('*').order('created_at', { ascending: false }),
        supabase.from('santunan').select('*, anggota(*), kematian(*)').order('created_at', { ascending: false }),
      ]);

      const anggota = anggotaRes.data as Anggota[] || [];
      const iuran = iuranRes.data as Iuran[] || [];

      setAnggotaList(anggota);
      setIuranList(iuran);
      setKasList(kasRes.data as Kas[] || []);
      setSantunanList(santunanRes.data as Santunan[] || []);

      // Build KK Iuran Report
      const kkMap = new Map<string, KKIuranReport>();
      
      anggota.forEach(a => {
        if (!kkMap.has(a.no_kk)) {
          kkMap.set(a.no_kk, {
            no_kk: a.no_kk,
            kepala_keluarga: '',
            anggota_list: [],
            iuran_list: [],
            total_iuran: 0,
            total_lunas: 0,
            total_belum_bayar: 0,
          });
        }
        const kk = kkMap.get(a.no_kk)!;
        kk.anggota_list.push(a);
        if (a.hubungan_kk === 'Kepala Keluarga') {
          kk.kepala_keluarga = a.nama_lengkap;
        }
      });

      // Assign iuran to KK
      iuran.forEach(i => {
        const noKK = i.no_kk || i.anggota?.no_kk;
        if (noKK && kkMap.has(noKK)) {
          const kk = kkMap.get(noKK)!;
          kk.iuran_list.push(i);
          kk.total_iuran += i.nominal;
          if (i.status === 'lunas') {
            kk.total_lunas += i.nominal;
          } else if (i.status === 'belum_bayar' || i.status === 'ditolak') {
            kk.total_belum_bayar += i.nominal;
          }
        }
      });

      // Set default kepala_keluarga if not found
      kkMap.forEach(kk => {
        if (!kk.kepala_keluarga && kk.anggota_list.length > 0) {
          kk.kepala_keluarga = kk.anggota_list[0].nama_lengkap;
        }
      });

      setKkIuranReport(Array.from(kkMap.values()).sort((a, b) => a.kepala_keluarga.localeCompare(b.kepala_keluarga)));
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

  const totalAnggotaAktif = anggotaList.filter(a => a.status === 'aktif').length;
  const totalKK = kkIuranReport.length;
  const totalIuranLunas = iuranList.filter(i => i.status === 'lunas').length;
  const saldoKas = kasList.reduce((acc, k) => acc + (k.jenis === 'pemasukan' ? k.nominal : -k.nominal), 0);
  const totalSantunanDisalurkan = santunanList.filter(s => s.status === 'disalurkan').reduce((acc, s) => acc + s.nominal_akhir, 0);

  // Export configurations
  const anggotaExportColumns = [
    { key: 'nama_lengkap', header: 'Nama' },
    { key: 'nik', header: 'NIK' },
    { key: 'no_hp', header: 'No HP' },
    { key: 'alamat', header: 'Alamat' },
    { key: 'status', header: 'Status' },
    { key: 'tanggal_bergabung', header: 'Bergabung', format: (v: string) => formatDate(v) },
  ];

  const iuranExportColumns = [
    { key: 'no_kk', header: 'No. KK', format: (_: any, row: Iuran) => row.no_kk || row.anggota?.no_kk || '-' },
    { key: 'anggota', header: 'Kepala Keluarga', format: (_: any, row: Iuran) => row.anggota?.nama_lengkap || '-' },
    { key: 'periode', header: 'Periode', format: (v: string) => formatPeriode(v) },
    { key: 'nominal', header: 'Nominal', format: (v: number) => formatCurrency(v) },
    { key: 'status', header: 'Status' },
    { key: 'jatuh_tempo', header: 'Jatuh Tempo', format: (v: string) => formatDate(v) },
  ];

  const kkIuranExportColumns = [
    { key: 'no_kk', header: 'No. KK' },
    { key: 'kepala_keluarga', header: 'Kepala Keluarga' },
    { key: 'anggota_count', header: 'Jml Anggota', format: (_: any, row: KKIuranReport) => row.anggota_list.length.toString() },
    { key: 'total_iuran', header: 'Total Iuran', format: (v: number) => formatCurrency(v) },
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

  const iuranColumns = [
    {
      key: 'no_kk',
      header: 'No. KK',
      cell: (item: Iuran) => (
        <div>
          <p className="font-medium">{item.no_kk || item.anggota?.no_kk || '-'}</p>
          <p className="text-xs text-muted-foreground">{item.anggota?.nama_lengkap}</p>
        </div>
      ),
    },
    {
      key: 'periode',
      header: 'Periode',
      cell: (item: Iuran) => formatPeriode(item.periode),
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: Iuran) => formatCurrency(item.nominal),
      className: 'hidden md:table-cell',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: Iuran) => <StatusBadge status={item.status} />,
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

  return (
    <AdminLayout>
      <PageHeader title="Laporan" description="Lihat dan cetak laporan RUKEM" />

      <div className="grid gap-4 md:grid-cols-5 mt-6">
        <StatCard
          title="Anggota Aktif"
          value={totalAnggotaAktif}
          icon={Users}
        />
        <StatCard
          title="Total KK"
          value={totalKK}
          icon={Home}
          iconClassName="bg-primary/10"
        />
        <StatCard
          title="Iuran Lunas"
          value={totalIuranLunas}
          icon={Receipt}
          iconClassName="bg-success/10"
        />
        <StatCard
          title="Saldo Kas"
          value={formatCurrency(saldoKas)}
          icon={Wallet}
          iconClassName="bg-info/10"
        />
        <StatCard
          title="Total Santunan"
          value={formatCurrency(totalSantunanDisalurkan)}
          icon={HandHeart}
          iconClassName="bg-warning/10"
        />
      </div>

      <Tabs defaultValue="iuran-kk" className="mt-6">
        <TabsList className="w-full md:w-auto grid grid-cols-5 md:flex">
          <TabsTrigger value="iuran-kk">Iuran per KK</TabsTrigger>
          <TabsTrigger value="anggota">Anggota</TabsTrigger>
          <TabsTrigger value="iuran">Iuran</TabsTrigger>
          <TabsTrigger value="kas">Kas</TabsTrigger>
          <TabsTrigger value="santunan">Santunan</TabsTrigger>
        </TabsList>

        <TabsContent value="iuran-kk" className="mt-4">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-base">Laporan Iuran per Kartu Keluarga</CardTitle>
                <ExportButtons
                  onExportPDF={() => exportToPDF(filteredKkIuranReport, kkIuranExportColumns, `Laporan Iuran per KK RUKEM${selectedPeriode !== 'all' ? ` - ${formatPeriode(selectedPeriode)}` : ''}`, 'laporan-iuran-kk')}
                  onExportExcel={() => exportToExcel(filteredKkIuranReport, kkIuranExportColumns, 'Iuran per KK', 'laporan-iuran-kk')}
                  disabled={filteredKkIuranReport.length === 0}
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
                    {filteredKkIuranReport.length} KK
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredKkIuranReport.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {selectedPeriode === 'all' ? 'Belum ada data iuran' : `Tidak ada data iuran untuk periode ${formatPeriode(selectedPeriode)}`}
                </p>
              ) : (
              <div className="space-y-2">
                {filteredKkIuranReport.map((kk) => {
                  const isExpanded = expandedKK.has(kk.no_kk);
                  const lunasCount = kk.iuran_list.filter(i => i.status === 'lunas').length;
                  const totalCount = kk.iuran_list.length;
                  
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

                          {/* Iuran History */}
                          <div>
                            <p className="text-sm font-medium mb-2">Riwayat Iuran:</p>
                            {kk.iuran_list.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Belum ada data iuran</p>
                            ) : (
                              <div className="space-y-2">
                                {kk.iuran_list.slice(0, 6).map((iuran) => (
                                  <div 
                                    key={iuran.id} 
                                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                                  >
                                    <div>
                                      <p className="font-medium">{formatPeriode(iuran.periode)}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Jatuh tempo: {formatDate(iuran.jatuh_tempo)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <p className="font-medium">{formatCurrency(iuran.nominal)}</p>
                                      <StatusBadge status={iuran.status} />
                                    </div>
                                  </div>
                                ))}
                                {kk.iuran_list.length > 6 && (
                                  <p className="text-sm text-muted-foreground text-center py-2">
                                    +{kk.iuran_list.length - 6} iuran lainnya
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Summary */}
                          <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-xs text-muted-foreground">Total Iuran</p>
                              <p className="font-bold">{formatCurrency(kk.total_iuran)}</p>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Laporan Anggota</CardTitle>
              <ExportButtons
                onExportPDF={() => exportToPDF(anggotaList, anggotaExportColumns, 'Laporan Data Anggota RUKEM', 'laporan-anggota')}
                onExportExcel={() => exportToExcel(anggotaList, anggotaExportColumns, 'Anggota', 'laporan-anggota')}
                disabled={anggotaList.length === 0}
              />
            </CardHeader>
            <CardContent>
              <DataTable columns={anggotaColumns} data={anggotaList} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iuran" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Laporan Iuran</CardTitle>
              <ExportButtons
                onExportPDF={() => exportToPDF(iuranList, iuranExportColumns, 'Laporan Data Iuran RUKEM', 'laporan-iuran')}
                onExportExcel={() => exportToExcel(iuranList, iuranExportColumns, 'Iuran', 'laporan-iuran')}
                disabled={iuranList.length === 0}
              />
            </CardHeader>
            <CardContent>
              <DataTable columns={iuranColumns} data={iuranList} />
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
