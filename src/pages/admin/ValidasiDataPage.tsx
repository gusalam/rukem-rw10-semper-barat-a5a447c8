import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { ExportButtons } from '@/components/ui/export-buttons';
import { 
  AlertTriangle, 
  Users, 
  Home, 
  FileWarning, 
  CheckCircle2, 
  Loader2,
  Wrench,
  RefreshCw
} from 'lucide-react';
import type { Anggota } from '@/types/database';

interface DataIssue {
  type: 'kk_tanpa_kepala' | 'anggota_tanpa_status' | 'data_tidak_lengkap';
  data: Anggota[];
  count: number;
}

interface KKGroup {
  no_kk: string;
  anggota: Anggota[];
  hasKepala: boolean;
}

export default function ValidasiDataPage() {
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('anggota')
        .select('*')
        .order('no_kk')
        .order('nama_lengkap');

      if (error) throw error;
      setAnggotaList(data as Anggota[] || []);
    } catch (error) {
      console.error('Error fetching anggota:', error);
      toast({
        variant: 'destructive',
        title: 'Gagal Memuat Data',
        description: 'Tidak dapat memuat data anggota',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Group anggota by KK
  const kkGroups: KKGroup[] = (() => {
    const groups = new Map<string, Anggota[]>();
    anggotaList.forEach(a => {
      if (!groups.has(a.no_kk)) {
        groups.set(a.no_kk, []);
      }
      groups.get(a.no_kk)!.push(a);
    });
    return Array.from(groups.entries()).map(([no_kk, anggota]) => ({
      no_kk,
      anggota,
      hasKepala: anggota.some(a => a.hubungan_kk === 'Kepala Keluarga' && a.status === 'aktif'),
    }));
  })();

  // Filter only active KK (has at least one active member)
  const activeKKGroups = kkGroups.filter(kk => 
    kk.anggota.some(a => a.status === 'aktif')
  );

  // Issues
  const kkTanpaKepala = activeKKGroups.filter(kk => !kk.hasKepala);
  const anggotaTanpaStatus = anggotaList.filter(a => !a.status);
  const anggotaDataTidakLengkap = anggotaList.filter(a => 
    !a.nik || !a.no_kk || !a.nama_lengkap || !a.alamat || !a.no_hp || !a.hubungan_kk
  );

  const totalIssues = kkTanpaKepala.length + anggotaTanpaStatus.length + anggotaDataTidakLengkap.length;

  // Fix: Update anggota tanpa status menjadi aktif
  const handleFixStatus = async () => {
    setFixing('status');
    try {
      const { error } = await supabase
        .from('anggota')
        .update({ status: 'aktif' })
        .or('status.is.null');

      if (error) throw error;

      toast({
        title: '✓ Perbaikan Selesai',
        description: `${anggotaTanpaStatus.length} anggota berhasil diupdate dengan status "aktif"`,
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Memperbaiki',
        description: error.message,
      });
    } finally {
      setFixing(null);
    }
  };

  // Export columns
  const kkTanpaKepalaExportColumns = [
    { key: 'no', header: 'No' },
    { key: 'no_kk', header: 'No. KK' },
    { key: 'jumlah_anggota', header: 'Jumlah Anggota' },
    { key: 'anggota_list', header: 'Daftar Anggota' },
  ];

  const anggotaExportColumns = [
    { key: 'no', header: 'No' },
    { key: 'nama_lengkap', header: 'Nama Lengkap' },
    { key: 'nik', header: 'NIK' },
    { key: 'no_kk', header: 'No. KK' },
    { key: 'hubungan_kk', header: 'Hubungan KK' },
    { key: 'status', header: 'Status' },
    { key: 'masalah', header: 'Masalah' },
  ];

  const handleExportKKTanpaKepala = (format: 'pdf' | 'excel') => {
    const data = kkTanpaKepala.map((kk, idx) => ({
      no: idx + 1,
      no_kk: kk.no_kk,
      jumlah_anggota: kk.anggota.filter(a => a.status === 'aktif').length,
      anggota_list: kk.anggota
        .filter(a => a.status === 'aktif')
        .map(a => `${a.nama_lengkap} (${a.hubungan_kk || '-'})`)
        .join(', '),
    }));

    if (format === 'pdf') {
      exportToPDF(data, kkTanpaKepalaExportColumns, 'KK Tanpa Kepala Keluarga', 'kk-tanpa-kepala');
    } else {
      exportToExcel(data, kkTanpaKepalaExportColumns, 'KK Tanpa Kepala', 'kk-tanpa-kepala');
    }
  };

  const handleExportAnggotaTanpaStatus = (format: 'pdf' | 'excel') => {
    const data = anggotaTanpaStatus.map((a, idx) => ({
      no: idx + 1,
      nama_lengkap: a.nama_lengkap,
      nik: a.nik,
      no_kk: a.no_kk,
      hubungan_kk: a.hubungan_kk || '-',
      status: a.status || '(kosong)',
      masalah: 'Status tidak diisi',
    }));

    if (format === 'pdf') {
      exportToPDF(data, anggotaExportColumns, 'Anggota Tanpa Status', 'anggota-tanpa-status');
    } else {
      exportToExcel(data, anggotaExportColumns, 'Tanpa Status', 'anggota-tanpa-status');
    }
  };

  const handleExportDataTidakLengkap = (format: 'pdf' | 'excel') => {
    const data = anggotaDataTidakLengkap.map((a, idx) => {
      const masalah: string[] = [];
      if (!a.nik) masalah.push('NIK kosong');
      if (!a.no_kk) masalah.push('No KK kosong');
      if (!a.nama_lengkap) masalah.push('Nama kosong');
      if (!a.alamat) masalah.push('Alamat kosong');
      if (!a.no_hp) masalah.push('No HP kosong');
      if (!a.hubungan_kk) masalah.push('Hubungan KK kosong');

      return {
        no: idx + 1,
        nama_lengkap: a.nama_lengkap || '(kosong)',
        nik: a.nik || '(kosong)',
        no_kk: a.no_kk || '(kosong)',
        hubungan_kk: a.hubungan_kk || '(kosong)',
        status: a.status || '(kosong)',
        masalah: masalah.join(', '),
      };
    });

    if (format === 'pdf') {
      exportToPDF(data, anggotaExportColumns, 'Anggota Data Tidak Lengkap', 'data-tidak-lengkap');
    } else {
      exportToExcel(data, anggotaExportColumns, 'Data Tidak Lengkap', 'data-tidak-lengkap');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <PageHeader title="Validasi Data" description="Memeriksa data..." />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader 
          title="Validasi Data" 
          description="Deteksi dan perbaiki data anggota yang bermasalah"
        />
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary */}
      {totalIssues === 0 ? (
        <Alert className="mb-6 border-success bg-success/10">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertTitle className="text-success">Semua Data Valid</AlertTitle>
          <AlertDescription>
            Tidak ditemukan masalah pada data anggota. Semua KK memiliki Kepala Keluarga dan data lengkap.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Ditemukan {totalIssues} Masalah</AlertTitle>
          <AlertDescription>
            Perbaiki masalah di bawah ini untuk memastikan data sistem akurat.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs for each issue type */}
      <Tabs defaultValue="kk_tanpa_kepala" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="kk_tanpa_kepala" className="gap-2">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">KK Tanpa Kepala</span>
            {kkTanpaKepala.length > 0 && (
              <Badge variant="destructive" className="ml-1">{kkTanpaKepala.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tanpa_status" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Tanpa Status</span>
            {anggotaTanpaStatus.length > 0 && (
              <Badge variant="destructive" className="ml-1">{anggotaTanpaStatus.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="data_tidak_lengkap" className="gap-2">
            <FileWarning className="h-4 w-4" />
            <span className="hidden sm:inline">Data Tidak Lengkap</span>
            {anggotaDataTidakLengkap.length > 0 && (
              <Badge variant="destructive" className="ml-1">{anggotaDataTidakLengkap.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* KK Tanpa Kepala Keluarga */}
        <TabsContent value="kk_tanpa_kepala">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-warning" />
                    KK Tanpa Kepala Keluarga
                  </CardTitle>
                  <CardDescription>
                    KK aktif yang tidak memiliki anggota dengan status "Kepala Keluarga"
                  </CardDescription>
                </div>
                {kkTanpaKepala.length > 0 && (
                  <ExportButtons
                    onExportPDF={() => handleExportKKTanpaKepala('pdf')}
                    onExportExcel={() => handleExportKKTanpaKepala('excel')}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {kkTanpaKepala.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-success" />
                  <p>Semua KK memiliki Kepala Keluarga</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {kkTanpaKepala.map((kk, idx) => (
                      <div 
                        key={kk.no_kk} 
                        className="p-4 border rounded-lg bg-muted/30"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-mono text-sm font-medium">{kk.no_kk}</p>
                            <p className="text-xs text-muted-foreground">
                              {kk.anggota.filter(a => a.status === 'aktif').length} anggota aktif
                            </p>
                          </div>
                          <Badge variant="outline" className="text-warning border-warning">
                            Tanpa Kepala KK
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {kk.anggota
                            .filter(a => a.status === 'aktif')
                            .map(a => (
                              <Badge key={a.id} variant="secondary" className="text-xs">
                                {a.nama_lengkap} ({a.hubungan_kk || '-'})
                              </Badge>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Anggota Tanpa Status */}
        <TabsContent value="tanpa_status">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-warning" />
                    Anggota Tanpa Status
                  </CardTitle>
                  <CardDescription>
                    Anggota yang tidak memiliki status (aktif/nonaktif/meninggal)
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {anggotaTanpaStatus.length > 0 && (
                    <>
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={handleFixStatus}
                        disabled={fixing === 'status'}
                      >
                        {fixing === 'status' ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Wrench className="h-4 w-4 mr-2" />
                        )}
                        Perbaiki Semua
                      </Button>
                      <ExportButtons
                        onExportPDF={() => handleExportAnggotaTanpaStatus('pdf')}
                        onExportExcel={() => handleExportAnggotaTanpaStatus('excel')}
                      />
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {anggotaTanpaStatus.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-success" />
                  <p>Semua anggota memiliki status</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {anggotaTanpaStatus.map((a, idx) => (
                      <div 
                        key={a.id} 
                        className="p-3 border rounded-lg bg-muted/30 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{a.nama_lengkap}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            NIK: {a.nik} | KK: {a.no_kk}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-warning border-warning">
                          Tanpa Status
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Tidak Lengkap */}
        <TabsContent value="data_tidak_lengkap">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileWarning className="h-5 w-5 text-warning" />
                    Data Tidak Lengkap
                  </CardTitle>
                  <CardDescription>
                    Anggota dengan field penting yang kosong (NIK, No KK, Nama, Alamat, No HP, Hubungan KK)
                  </CardDescription>
                </div>
                {anggotaDataTidakLengkap.length > 0 && (
                  <ExportButtons
                    onExportPDF={() => handleExportDataTidakLengkap('pdf')}
                    onExportExcel={() => handleExportDataTidakLengkap('excel')}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {anggotaDataTidakLengkap.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-success" />
                  <p>Semua data anggota lengkap</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {anggotaDataTidakLengkap.map((a, idx) => {
                      const missingFields: string[] = [];
                      if (!a.nik) missingFields.push('NIK');
                      if (!a.no_kk) missingFields.push('No KK');
                      if (!a.nama_lengkap) missingFields.push('Nama');
                      if (!a.alamat) missingFields.push('Alamat');
                      if (!a.no_hp) missingFields.push('No HP');
                      if (!a.hubungan_kk) missingFields.push('Hubungan KK');

                      return (
                        <div 
                          key={a.id} 
                          className="p-3 border rounded-lg bg-muted/30"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium">{a.nama_lengkap || '(Nama kosong)'}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                NIK: {a.nik || '-'} | KK: {a.no_kk || '-'}
                              </p>
                            </div>
                            <Badge variant="secondary">{a.status || 'Tanpa Status'}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {missingFields.map(field => (
                              <Badge key={field} variant="outline" className="text-destructive border-destructive text-xs">
                                {field} kosong
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}