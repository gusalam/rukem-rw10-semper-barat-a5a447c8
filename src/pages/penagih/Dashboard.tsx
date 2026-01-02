import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExportButtons } from '@/components/ui/export-buttons';
import { Users, Clock, CheckCircle, MapPin, AlertCircle, CreditCard, TrendingUp, Calendar, Receipt } from 'lucide-react';
import { formatCurrency, formatPeriode, formatDate } from '@/lib/format';
import { exportToPDF, exportToExcel } from '@/lib/export';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { IuranTagihan, Anggota, IuranPembayaran } from '@/types/database';

interface TagihanWithKK extends IuranTagihan {
  kepala_keluarga?: Anggota;
}

interface PembayaranWithTagihan extends IuranPembayaran {
  tagihan?: IuranTagihan;
  kepala_keluarga?: Anggota;
}

interface DashboardStats {
  totalAnggota: number;
  totalKK: number;
  tagihanBelumBayar: number;
  tagihanMenungguAdmin: number;
  tagihanLunas: number;
  nominalBelumBayar: number;
  nominalMenungguAdmin: number;
  // New stats
  uangTerkumpulHariIni: number;
  uangTerkumpulBulanIni: number;
  totalPembayaranDisetujui: number;
}

export default function PenagihDashboard() {
  const { user, penagihWilayah } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalAnggota: 0,
    totalKK: 0,
    tagihanBelumBayar: 0,
    tagihanMenungguAdmin: 0,
    tagihanLunas: 0,
    nominalBelumBayar: 0,
    nominalMenungguAdmin: 0,
    uangTerkumpulHariIni: 0,
    uangTerkumpulBulanIni: 0,
    totalPembayaranDisetujui: 0,
  });
  const [allTagihan, setAllTagihan] = useState<TagihanWithKK[]>([]);
  const [riwayatPembayaran, setRiwayatPembayaran] = useState<PembayaranWithTagihan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
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
      
      // Filter by penagih wilayah
      const filteredAnggota = anggotaData?.filter(a => 
        rtRwPairs.some(pair => pair.rt === a.rt && pair.rw === a.rw)
      ) || [];

      const uniqueKKs = [...new Set(filteredAnggota.map(a => a.no_kk))];

      let tagihanBelumBayar = 0;
      let tagihanMenungguAdmin = 0;
      let tagihanLunas = 0;
      let nominalBelumBayar = 0;
      let nominalMenungguAdmin = 0;
      let allTagihanList: TagihanWithKK[] = [];
      let pembayaranList: PembayaranWithTagihan[] = [];
      let uangTerkumpulHariIni = 0;
      let uangTerkumpulBulanIni = 0;
      let totalPembayaranDisetujui = 0;

      if (uniqueKKs.length > 0) {
        // Fetch tagihan
        const { data: tagihanData } = await supabase
          .from('iuran_tagihan')
          .select('*')
          .in('no_kk', uniqueKKs)
          .order('jatuh_tempo', { ascending: false });

        // Fetch pembayaran by this penagih
        const { data: pembayaranData } = await supabase
          .from('iuran_pembayaran')
          .select('*, iuran_tagihan(*)')
          .eq('penagih_user_id', user.id)
          .order('tanggal_bayar', { ascending: false });

        if (tagihanData) {
          tagihanBelumBayar = tagihanData.filter(t => t.status === 'belum_bayar').length;
          tagihanMenungguAdmin = tagihanData.filter(t => t.status === 'menunggu_admin').length;
          tagihanLunas = tagihanData.filter(t => t.status === 'lunas').length;
          nominalBelumBayar = tagihanData
            .filter(t => t.status === 'belum_bayar')
            .reduce((sum, t) => sum + t.nominal, 0);
          nominalMenungguAdmin = tagihanData
            .filter(t => t.status === 'menunggu_admin')
            .reduce((sum, t) => sum + t.nominal, 0);

          // Map tagihan with kepala keluarga
          allTagihanList = tagihanData.map(t => {
            const kepala = filteredAnggota.find(a => 
              a.no_kk === t.no_kk && a.hubungan_kk === 'Kepala Keluarga'
            ) || filteredAnggota.find(a => a.no_kk === t.no_kk);
            return { ...t, kepala_keluarga: kepala as Anggota } as TagihanWithKK;
          });
        }

        if (pembayaranData) {
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

          pembayaranList = pembayaranData.map((p: any) => {
            const tagihan = p.iuran_tagihan as IuranTagihan;
            const kepala = tagihan ? filteredAnggota.find(a => 
              a.no_kk === tagihan.no_kk && a.hubungan_kk === 'Kepala Keluarga'
            ) || filteredAnggota.find(a => a.no_kk === tagihan.no_kk) : null;
            return {
              ...p,
              tagihan,
              kepala_keluarga: kepala as Anggota
            } as PembayaranWithTagihan;
          });

          // Calculate money collected (only approved payments)
          const approvedPayments = pembayaranData.filter((p: any) => p.status === 'disetujui');
          
          totalPembayaranDisetujui = approvedPayments.reduce((sum: number, p: any) => sum + p.nominal, 0);
          
          uangTerkumpulHariIni = approvedPayments
            .filter((p: any) => new Date(p.approved_at || p.tanggal_bayar) >= new Date(todayStart))
            .reduce((sum: number, p: any) => sum + p.nominal, 0);
          
          uangTerkumpulBulanIni = approvedPayments
            .filter((p: any) => new Date(p.approved_at || p.tanggal_bayar) >= new Date(monthStart))
            .reduce((sum: number, p: any) => sum + p.nominal, 0);
        }
      }

      setStats({
        totalAnggota: filteredAnggota.length,
        totalKK: uniqueKKs.length,
        tagihanBelumBayar,
        tagihanMenungguAdmin,
        tagihanLunas,
        nominalBelumBayar,
        nominalMenungguAdmin,
        uangTerkumpulHariIni,
        uangTerkumpulBulanIni,
        totalPembayaranDisetujui,
      });
      setAllTagihan(allTagihanList);
      setRiwayatPembayaran(pembayaranList);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, penagihWilayah]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Realtime subscription for updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('penagih-dashboard-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'iuran_pembayaran' },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'iuran_tagihan' },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchStats]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'menunggu_admin':
        return 'Menunggu Verifikasi';
      case 'disetujui':
        return 'Disetujui';
      case 'ditolak':
        return 'Ditolak';
      default:
        return status;
    }
  };

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
    return riwayatPembayaran.map((p, idx) => ({
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
    exportToPDF(
      data,
      exportColumns,
      `Laporan Pembayaran Penagih - ${wilayahText}`,
      `laporan-pembayaran-${new Date().toISOString().split('T')[0]}`
    );
    toast.success('Berhasil export ke PDF');
  };

  const handleExportExcel = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('Tidak ada data untuk di-export');
      return;
    }
    exportToExcel(
      data,
      exportColumns,
      'Pembayaran',
      `laporan-pembayaran-${new Date().toISOString().split('T')[0]}`
    );
    toast.success('Berhasil export ke Excel');
  };

  if (loading) {
    return (
      <PenagihLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </PenagihLayout>
    );
  }

  return (
    <PenagihLayout>
      <PageHeader 
        title="Dashboard Penagih" 
        description="Kelola tagihan iuran di wilayah Anda"
      />

      {penagihWilayah.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">Belum Ada Wilayah</h3>
            <p className="text-muted-foreground">
              Anda belum ditugaskan ke wilayah manapun. Hubungi admin untuk mendapatkan akses.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Wilayah Info */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Wilayah Anda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {penagihWilayah.map((w, idx) => (
                  <span 
                    key={idx}
                    className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
                  >
                    RT {w.rt} / RW {w.rw}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Total KK"
              value={stats.totalKK}
              icon={Users}
              description={`${stats.totalAnggota} anggota`}
            />
            <StatCard
              title="Tagihan Aktif"
              value={stats.tagihanBelumBayar}
              icon={AlertCircle}
              description={formatCurrency(stats.nominalBelumBayar)}
              className="border-destructive/20"
            />
            <StatCard
              title="Terkumpul Hari Ini"
              value={formatCurrency(stats.uangTerkumpulHariIni)}
              icon={TrendingUp}
              description="Sudah disetujui admin"
              className="border-success/20"
            />
            <StatCard
              title="Terkumpul Bulan Ini"
              value={formatCurrency(stats.uangTerkumpulBulanIni)}
              icon={Calendar}
              description="Sudah disetujui admin"
              className="border-success/20"
            />
          </div>

          {/* Tabs for different views */}
          <Tabs defaultValue="ringkasan" className="space-y-4">
            <div className="overflow-x-auto">
              <TabsList className="inline-flex w-max min-w-full sm:min-w-0">
                <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
                <TabsTrigger value="tagihan">Riwayat Tagihan</TabsTrigger>
                <TabsTrigger value="pembayaran">Input Pembayaran</TabsTrigger>
                <TabsTrigger value="rekap">Rekap Uang</TabsTrigger>
              </TabsList>
            </div>

            {/* Ringkasan Tab */}
            <TabsContent value="ringkasan" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ringkasan Status */}
                <Card>
                  <CardHeader>
                    <CardTitle>Ringkasan Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-destructive/10 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-destructive" />
                          <span>Belum Dibayar</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatCurrency(stats.nominalBelumBayar)}</p>
                          <p className="text-xs text-muted-foreground">{stats.tagihanBelumBayar} tagihan</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-warning/10 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-warning" />
                          <span>Menunggu Verifikasi</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatCurrency(stats.nominalMenungguAdmin)}</p>
                          <p className="text-xs text-muted-foreground">{stats.tagihanMenungguAdmin} tagihan</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-success/10 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-success" />
                          <span>Total Disetujui</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatCurrency(stats.totalPembayaranDisetujui)}</p>
                          <p className="text-xs text-muted-foreground">{stats.tagihanLunas} tagihan lunas</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tagihan Perlu Ditagih */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Tagihan Perlu Ditagih</CardTitle>
                    <Link to="/penagih/tagihan">
                      <Button variant="outline" size="sm">
                        Lihat Semua
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {allTagihan.filter(t => t.status === 'belum_bayar').length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-10 w-10 mx-auto mb-2 text-success" />
                        <p>Semua tagihan sudah dibayar!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {allTagihan
                          .filter(t => t.status === 'belum_bayar')
                          .slice(0, 5)
                          .map((tagihan) => (
                            <div 
                              key={tagihan.id} 
                              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-sm">
                                  {tagihan.kepala_keluarga?.nama_lengkap || 'KK: ' + tagihan.no_kk}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatPeriode(tagihan.periode)} • Jatuh tempo: {formatDate(tagihan.jatuh_tempo)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm text-primary">
                                  {formatCurrency(tagihan.nominal)}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Quick Action */}
              <Card>
                <CardContent className="py-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">Mulai Menagih</h3>
                      <p className="text-sm text-muted-foreground">
                        Lihat daftar lengkap tagihan dan catat pembayaran dari warga
                      </p>
                    </div>
                    <Link to="/penagih/tagihan">
                      <Button>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Kelola Tagihan
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Riwayat Tagihan Tab */}
            <TabsContent value="tagihan">
              <Card>
                <CardHeader>
                  <CardTitle>Semua Tagihan di Wilayah Anda</CardTitle>
                </CardHeader>
                <CardContent>
                  {allTagihan.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Belum ada tagihan</p>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {allTagihan.map((tagihan) => (
                        <div 
                          key={tagihan.id} 
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Receipt className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {tagihan.kepala_keluarga?.nama_lengkap || 'KK: ' + tagihan.no_kk}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatPeriode(tagihan.periode)} • {formatCurrency(tagihan.nominal)}
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={tagihan.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Riwayat Input Pembayaran Tab */}
            <TabsContent value="pembayaran">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Riwayat Input Pembayaran</CardTitle>
                  <ExportButtons 
                    onExportPDF={handleExportPDF}
                    onExportExcel={handleExportExcel}
                    disabled={riwayatPembayaran.length === 0}
                  />
                </CardHeader>
                <CardContent>
                  {riwayatPembayaran.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Belum ada pembayaran yang diinput</p>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {riwayatPembayaran.map((pembayaran) => (
                        <div 
                          key={pembayaran.id} 
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              pembayaran.status === 'disetujui' ? 'bg-success/10' :
                              pembayaran.status === 'ditolak' ? 'bg-destructive/10' :
                              'bg-warning/10'
                            }`}>
                              {pembayaran.status === 'disetujui' ? (
                                <CheckCircle className="h-4 w-4 text-success" />
                              ) : pembayaran.status === 'ditolak' ? (
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              ) : (
                                <Clock className="h-4 w-4 text-warning" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {pembayaran.kepala_keluarga?.nama_lengkap || 
                                  (pembayaran.tagihan ? 'KK: ' + pembayaran.tagihan.no_kk : 'Pembayaran')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {pembayaran.tagihan && formatPeriode(pembayaran.tagihan.periode)} • {formatDate(pembayaran.tanggal_bayar)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">{formatCurrency(pembayaran.nominal)}</p>
                            <p className={`text-xs ${
                              pembayaran.status === 'disetujui' ? 'text-success' :
                              pembayaran.status === 'ditolak' ? 'text-destructive' :
                              'text-warning'
                            }`}>
                              {getStatusLabel(pembayaran.status)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Rekap Uang Tab */}
            <TabsContent value="rekap">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Rekap Harian
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-6">
                      <p className="text-3xl font-bold text-success">
                        {formatCurrency(stats.uangTerkumpulHariIni)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Terkumpul hari ini ({new Date().toLocaleDateString('id-ID')})
                      </p>
                    </div>
                    <div className="border-t pt-4 space-y-2">
                      {riwayatPembayaran
                        .filter(p => {
                          const today = new Date();
                          const payDate = new Date(p.approved_at || p.tanggal_bayar);
                          return p.status === 'disetujui' && 
                            payDate.toDateString() === today.toDateString();
                        })
                        .slice(0, 5)
                        .map((p) => (
                          <div key={p.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {p.kepala_keluarga?.nama_lengkap || 'Pembayaran'}
                            </span>
                            <span className="font-medium">{formatCurrency(p.nominal)}</span>
                          </div>
                        ))}
                      {riwayatPembayaran.filter(p => {
                        const today = new Date();
                        const payDate = new Date(p.approved_at || p.tanggal_bayar);
                        return p.status === 'disetujui' && 
                          payDate.toDateString() === today.toDateString();
                      }).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center">
                          Belum ada pembayaran hari ini
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Rekap Bulanan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-6">
                      <p className="text-3xl font-bold text-success">
                        {formatCurrency(stats.uangTerkumpulBulanIni)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Terkumpul bulan {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Total Disetujui</span>
                        <span className="font-bold text-success">{formatCurrency(stats.totalPembayaranDisetujui)}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Menunggu Verifikasi</span>
                        <span className="font-medium text-warning">{formatCurrency(stats.nominalMenungguAdmin)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Belum Ditagih</span>
                        <span className="font-medium text-destructive">{formatCurrency(stats.nominalBelumBayar)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </PenagihLayout>
  );
}
