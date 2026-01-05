import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExportButtons } from '@/components/ui/export-buttons';
import { DataTable } from '@/components/ui/data-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Home, Users, AlertTriangle, CheckCircle2, XCircle, Download, FileText, HelpCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from 'recharts';
import type { Anggota } from '@/types/database';
import { exportToPDF, exportToExcel } from '@/lib/export';

interface KKSummary {
  no_kk: string;
  kepala_keluarga: string;
  jumlah_anggota: number;
  status_kk: 'valid' | 'tanpa_kepala';
  anggota_list: Anggota[];
  rt: string | null;
  rw: string | null;
}

export default function RingkasanKKPage() {
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAnggotaAktif, setTotalAnggotaAktif] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // === COUNT langsung dari database (tidak terbatas limit 1000) ===
      const { count: countAnggotaAktif } = await supabase
        .from('anggota')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'aktif');

      setTotalAnggotaAktif(countAnggotaAktif || 0);

      // Fetch semua data anggota aktif dengan batching
      const allAnggota: Anggota[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data } = await supabase
          .from('anggota')
          .select('*')
          .eq('status', 'aktif')
          .order('nama_lengkap')
          .range(offset, offset + batchSize - 1);

        if (data && data.length > 0) {
          allAnggota.push(...(data as Anggota[]));
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      setAnggotaList(allAnggota);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build KK summary
  const kkSummaryList = useMemo(() => {
    const kkMap = new Map<string, KKSummary>();

    anggotaList.forEach(anggota => {
      if (!kkMap.has(anggota.no_kk)) {
        kkMap.set(anggota.no_kk, {
          no_kk: anggota.no_kk,
          kepala_keluarga: '',
          jumlah_anggota: 0,
          status_kk: 'tanpa_kepala',
          anggota_list: [],
          rt: anggota.rt,
          rw: anggota.rw,
        });
      }

      const kk = kkMap.get(anggota.no_kk)!;
      kk.anggota_list.push(anggota);
      kk.jumlah_anggota++;

      if (anggota.status_dalam_kk === 'kepala_keluarga') {
        kk.kepala_keluarga = anggota.nama_lengkap;
        kk.status_kk = 'valid';
        kk.rt = anggota.rt;
        kk.rw = anggota.rw;
      }
    });

    // Set fallback kepala keluarga name if none found
    kkMap.forEach(kk => {
      if (!kk.kepala_keluarga && kk.anggota_list.length > 0) {
        kk.kepala_keluarga = kk.anggota_list[0].nama_lengkap + ' (belum ada kepala)';
      }
    });

    return Array.from(kkMap.values()).sort((a, b) => 
      a.status_kk === b.status_kk 
        ? a.kepala_keluarga.localeCompare(b.kepala_keluarga)
        : a.status_kk === 'tanpa_kepala' ? -1 : 1
    );
  }, [anggotaList]);

  // Statistics
  const totalKKSemua = kkSummaryList.length;
  const kkAktifValid = kkSummaryList.filter(kk => kk.status_kk === 'valid').length;
  const kkTanpaKepala = kkSummaryList.filter(kk => kk.status_kk === 'tanpa_kepala').length;
  const totalAnggota = anggotaList.length;

  // Chart data
  const pieChartData = [
    { name: 'KK Aktif (Valid)', value: kkAktifValid, color: 'hsl(var(--success))' },
    { name: 'KK Tanpa Kepala', value: kkTanpaKepala, color: 'hsl(var(--warning))' },
  ];

  const barChartData = [
    { name: 'Total KK (Semua)', value: totalKKSemua, fill: 'hsl(var(--primary))' },
    { name: 'KK Aktif (Valid)', value: kkAktifValid, fill: 'hsl(var(--success))' },
    { name: 'KK Tanpa Kepala', value: kkTanpaKepala, fill: 'hsl(var(--warning))' },
  ];

  // Export configurations
  const kkExportColumns = [
    { key: 'no_kk', header: 'No. KK' },
    { key: 'kepala_keluarga', header: 'Kepala Keluarga' },
    { key: 'rt', header: 'RT', format: (v: string | null) => v || '-' },
    { key: 'rw', header: 'RW', format: (v: string | null) => v || '-' },
    { key: 'jumlah_anggota', header: 'Jml Anggota' },
    { key: 'status_kk', header: 'Status KK', format: (v: string) => v === 'valid' ? 'Valid' : 'Tanpa Kepala' },
  ];

  // Detailed export with members
  const generateDetailedExport = () => {
    const detailedData: any[] = [];
    
    kkSummaryList.forEach(kk => {
      kk.anggota_list.forEach((anggota, index) => {
        detailedData.push({
          no_kk: kk.no_kk,
          kepala_keluarga: kk.kepala_keluarga,
          status_kk: kk.status_kk === 'valid' ? 'Valid' : 'Tanpa Kepala',
          rt: kk.rt || '-',
          rw: kk.rw || '-',
          no: index + 1,
          nama_anggota: anggota.nama_lengkap,
          nik: anggota.nik,
          status_dalam_kk: anggota.status_dalam_kk || '-',
          no_hp: anggota.no_hp || '-',
        });
      });
    });

    return detailedData;
  };

  const detailedExportColumns = [
    { key: 'no_kk', header: 'No. KK' },
    { key: 'kepala_keluarga', header: 'Kepala Keluarga' },
    { key: 'status_kk', header: 'Status KK' },
    { key: 'rt', header: 'RT' },
    { key: 'rw', header: 'RW' },
    { key: 'no', header: 'No' },
    { key: 'nama_anggota', header: 'Nama Anggota' },
    { key: 'nik', header: 'NIK' },
    { key: 'status_dalam_kk', header: 'Status Dalam KK' },
    { key: 'no_hp', header: 'No HP' },
  ];

  const tableColumns = [
    {
      key: 'kepala_keluarga',
      header: 'Kepala Keluarga',
      cell: (item: KKSummary) => (
        <div>
          <p className="font-medium">{item.kepala_keluarga}</p>
          <p className="text-xs text-muted-foreground font-mono">{item.no_kk}</p>
        </div>
      ),
    },
    {
      key: 'wilayah',
      header: 'Wilayah',
      cell: (item: KKSummary) => item.rt && item.rw ? `RT ${item.rt}/RW ${item.rw}` : '-',
      className: 'hidden md:table-cell',
    },
    {
      key: 'jumlah_anggota',
      header: 'Anggota',
      cell: (item: KKSummary) => (
        <Badge variant="secondary">{item.jumlah_anggota} orang</Badge>
      ),
    },
    {
      key: 'status_kk',
      header: 'Status',
      cell: (item: KKSummary) => (
        item.status_kk === 'valid' ? (
          <Badge className="bg-success/10 text-success border-success/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Valid
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Tanpa Kepala
          </Badge>
        )
      ),
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
      <PageHeader 
        title="Ringkasan Data KK" 
        description="Perbandingan data Kartu Keluarga dan export laporan lengkap"
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mt-6">
        <StatCard
          title="Total KK (Semua Data)"
          value={totalKKSemua}
          icon={Home}
          tooltip="Jumlah semua Kartu Keluarga yang terdaftar di sistem, termasuk yang belum lengkap"
        />
        <StatCard
          title="KK Aktif (Valid)"
          value={kkAktifValid}
          icon={CheckCircle2}
          description="Dapat mengikuti iuran"
          tooltip="KK yang memiliki Kepala Keluarga terdaftar. Hanya KK ini yang bisa mengikuti iuran dan menerima santunan."
          iconClassName="bg-success/10"
        />
        <StatCard
          title="KK Tanpa Kepala"
          value={kkTanpaKepala}
          icon={AlertTriangle}
          description="Perlu dilengkapi"
          tooltip="KK yang belum memiliki Kepala Keluarga. Tidak bisa mengikuti iuran sampai ditunjuk Kepala KK."
          iconClassName="bg-warning/10"
          variant={kkTanpaKepala > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Total Anggota Aktif"
          value={totalAnggotaAktif}
          icon={Users}
          tooltip="Total anggota dengan status aktif dari semua KK (dihitung langsung dari database)"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2 mt-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Distribusi Status KK
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[250px]">
                    <p className="text-xs">Perbandingan antara KK yang sudah valid (punya Kepala Keluarga) dan yang belum</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>Persentase KK Valid vs Tanpa Kepala</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number, name: string) => [`${value} KK`, name]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Perbandingan Jumlah KK
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[250px]">
                    <p className="text-xs">Grafik batang menunjukkan jumlah masing-masing kategori KK</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>Visualisasi data KK dalam bentuk bar chart</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} layout="vertical">
                  <XAxis type="number" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={120}
                    tick={{ fontSize: 11 }}
                  />
                  <RechartsTooltip 
                    formatter={(value: number) => [`${value} KK`, 'Jumlah']}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warning if KK tanpa kepala exists */}
      {kkTanpaKepala > 0 && (
        <Alert variant="default" className="mt-6 border-warning/50 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Perhatian: {kkTanpaKepala} KK Belum Lengkap</AlertTitle>
          <AlertDescription>
            Terdapat {kkTanpaKepala} Kartu Keluarga yang belum memiliki Kepala Keluarga. 
            KK ini tidak dapat mengikuti iuran dan tidak tercatat dalam sistem tagihan.
            Silakan lengkapi data melalui halaman Anggota atau Migrasi Data.
          </AlertDescription>
        </Alert>
      )}

      {/* Export Section */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Export Laporan KK Lengkap</CardTitle>
              <CardDescription>
                Download data KK dalam format PDF atau Excel
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <ExportButtons
                onExportPDF={() => exportToPDF(kkSummaryList, kkExportColumns, 'Laporan Ringkasan KK RUKEM', 'laporan-ringkasan-kk')}
                onExportExcel={() => exportToExcel(kkSummaryList, kkExportColumns, 'Ringkasan KK', 'laporan-ringkasan-kk')}
                disabled={kkSummaryList.length === 0}
              />
              <Button
                variant="outline"
                onClick={() => exportToPDF(generateDetailedExport(), detailedExportColumns, 'Laporan Detail KK dan Anggota RUKEM', 'laporan-detail-kk-anggota')}
                disabled={kkSummaryList.length === 0}
              >
                <FileText className="h-4 w-4 mr-2" />
                Export Detail (PDF)
              </Button>
              <Button
                variant="outline"
                onClick={() => exportToExcel(generateDetailedExport(), detailedExportColumns, 'Detail KK Anggota', 'laporan-detail-kk-anggota')}
                disabled={kkSummaryList.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Detail (Excel)
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            <p><strong>Export Ringkasan:</strong> Daftar KK dengan jumlah anggota dan status</p>
            <p><strong>Export Detail:</strong> Daftar KK lengkap dengan semua anggota per KK</p>
          </div>
          <DataTable 
            columns={tableColumns} 
            data={kkSummaryList}
          />
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
