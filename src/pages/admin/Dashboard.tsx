import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useMultiRealtime } from '@/hooks/use-realtime';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AdminDashboardSkeleton } from '@/components/ui/admin-loading-skeleton';
import { KKTanpaKepalaWarning } from '@/components/admin/KKTanpaKepalaWarning';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCurrency, formatDate, formatPeriode } from '@/lib/format';
import { Users, Receipt, Wallet, Clock, RefreshCw, Home, TrendingUp, AlertTriangle, ArrowRight, Database, Radio, Wifi, WifiOff } from 'lucide-react';
import type { IuranTagihan, IuranPembayaran, Anggota } from '@/types/database';

interface DashboardStats {
  totalAnggota: number;
  totalKK: number;
  kkValid: number;
  anggotaAktif: number;
  totalTagihanBulanIni: number;
  totalLunas: number;
  saldoKas: number;
  pendingVerifikasi: number;
}

interface DataIssues {
  kkTanpaKepala: number;
  anggotaTanpaStatus: number;
  anggotaDataTidakLengkap: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAnggota: 0,
    totalKK: 0,
    kkValid: 0,
    anggotaAktif: 0,
    totalTagihanBulanIni: 0,
    totalLunas: 0,
    saldoKas: 0,
    pendingVerifikasi: 0,
  });
  const [pendingPayments, setPendingPayments] = useState<IuranPembayaran[]>([]);
  const [recentTagihan, setRecentTagihan] = useState<IuranTagihan[]>([]);
  const [dataIssues, setDataIssues] = useState<DataIssues>({
    kkTanpaKepala: 0,
    anggotaTanpaStatus: 0,
    anggotaDataTidakLengkap: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const navigate = useNavigate();

  const fetchDashboardData = useCallback(async () => {
    try {
      // === GUNAKAN COUNT LANGSUNG DARI DATABASE (tidak terbatas limit 1000) ===
      
      // Count total anggota
      const { count: totalAnggota } = await supabase
        .from('anggota')
        .select('*', { count: 'exact', head: true });

      // Count anggota aktif
      const { count: countAnggotaAktif } = await supabase
        .from('anggota')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'aktif');

      // === COUNT KK VALID LANGSUNG DARI DATABASE ===
      // KK Valid = KK yang memiliki kepala_keluarga aktif (count exact dari DB)
      const { count: kkValidCount } = await supabase
        .from('anggota')
        .select('no_kk', { count: 'exact', head: true })
        .eq('status', 'aktif')
        .eq('status_dalam_kk', 'kepala_keluarga');

      // Total KK = count distinct no_kk dari anggota aktif
      // Karena kita tidak bisa count distinct, kita fetch dan hitung di client
      // tapi menggunakan batch fetch untuk menghindari limit 1000
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
      const kkValid = kkValidCount || 0;
      const kkTanpaKepala = totalKK - kkValid;

      // Count anggota tanpa status (null)
      const { count: anggotaTanpaStatus } = await supabase
        .from('anggota')
        .select('*', { count: 'exact', head: true })
        .is('status', null);

      // Count anggota dengan data tidak lengkap (termasuk status_dalam_kk)
      const { data: incompleteData } = await supabase
        .from('anggota')
        .select('id, nik, no_kk, nama_lengkap, alamat, no_hp, status_dalam_kk');
      const anggotaDataTidakLengkap = incompleteData?.filter(a => 
        !a.nik || !a.no_kk || !a.nama_lengkap || !a.alamat || !a.no_hp || !a.status_dalam_kk
      ).length || 0;

      setDataIssues({
        kkTanpaKepala,
        anggotaTanpaStatus: anggotaTanpaStatus || 0,
        anggotaDataTidakLengkap,
      });

      // Fetch current month tagihan (per KK)
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: tagihanData } = await supabase
        .from('iuran_tagihan')
        .select('*')
        .like('periode', `${currentMonth}%`);

      const totalTagihanBulanIni = tagihanData?.length || 0;
      const totalLunas = tagihanData?.filter(t => t.status === 'lunas').length || 0;

      // Fetch kas balance
      const { data: kasData } = await supabase.from('kas').select('jenis, nominal');
      const saldoKas = kasData?.reduce((acc, k) => {
        return acc + (k.jenis === 'pemasukan' ? k.nominal : -k.nominal);
      }, 0) || 0;

      // Fetch pending verifications from iuran_pembayaran
      const { data: pendingData, count: pendingCount } = await supabase
        .from('iuran_pembayaran')
        .select('*, tagihan:iuran_tagihan(*)', { count: 'exact' })
        .eq('status', 'menunggu_admin')
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch recent tagihan
      const { data: recentData } = await supabase
        .from('iuran_tagihan')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        totalAnggota: totalAnggota || 0,
        totalKK,
        kkValid,
        anggotaAktif: countAnggotaAktif || 0,
        totalTagihanBulanIni,
        totalLunas,
        saldoKas,
        pendingVerifikasi: pendingCount || 0,
      });
      setDataIssues({
        kkTanpaKepala,
        anggotaTanpaStatus: anggotaTanpaStatus || 0,
        anggotaDataTidakLengkap,
      });
      setPendingPayments(pendingData as IuranPembayaran[] || []);
      setRecentTagihan(recentData as IuranTagihan[] || []);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Realtime subscriptions with status tracking
  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'iuran_pembayaran' },
        () => {
          console.log('[Dashboard] iuran_pembayaran change detected');
          setIsLive(true);
          fetchDashboardData();
          setTimeout(() => setIsLive(false), 2000);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'iuran_tagihan' },
        () => {
          console.log('[Dashboard] iuran_tagihan change detected');
          setIsLive(true);
          fetchDashboardData();
          setTimeout(() => setIsLive(false), 2000);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kas' },
        () => {
          console.log('[Dashboard] kas change detected');
          setIsLive(true);
          fetchDashboardData();
          setTimeout(() => setIsLive(false), 2000);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'anggota' },
        () => {
          console.log('[Dashboard] anggota change detected');
          setIsLive(true);
          fetchDashboardData();
          setTimeout(() => setIsLive(false), 2000);
        }
      )
      .subscribe((status) => {
        console.log('[Dashboard] Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
        } else {
          setRealtimeStatus('connecting');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData]);

  const paymentColumns = [
    {
      key: 'tagihan',
      header: 'KK',
      cell: (item: IuranPembayaran) => item.tagihan?.no_kk || '-',
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: IuranPembayaran) => formatCurrency(item.nominal),
    },
    {
      key: 'tanggal_bayar',
      header: 'Tanggal',
      cell: (item: IuranPembayaran) => formatDate(item.tanggal_bayar),
    },
  ];

  const tagihanColumns = [
    {
      key: 'no_kk',
      header: 'No. KK',
    },
    {
      key: 'periode',
      header: 'Periode',
      cell: (item: IuranTagihan) => formatPeriode(item.periode),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: IuranTagihan) => <StatusBadge status={item.status} />,
    },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <AdminDashboardSkeleton />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader 
          title="Dashboard" 
          description="Selamat datang di panel admin RUKEM"
        />
        <div className="flex items-center gap-3">
          {/* Real-time Status Indicator */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  realtimeStatus === 'connected' 
                    ? 'bg-success/10 text-success border border-success/30' 
                    : realtimeStatus === 'connecting'
                    ? 'bg-warning/10 text-warning border border-warning/30'
                    : 'bg-destructive/10 text-destructive border border-destructive/30'
                }`}>
                  {realtimeStatus === 'connected' ? (
                    <>
                      <Radio className={`h-3 w-3 ${isLive ? 'animate-pulse' : ''}`} />
                      <span className="hidden sm:inline">{isLive ? 'Memperbarui...' : 'Real-time Aktif'}</span>
                      <Wifi className="h-3 w-3 sm:hidden" />
                    </>
                  ) : realtimeStatus === 'connecting' ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span className="hidden sm:inline">Menghubungkan...</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3" />
                      <span className="hidden sm:inline">Terputus</span>
                    </>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {realtimeStatus === 'connected' 
                    ? 'Data akan otomatis diperbarui saat ada perubahan'
                    : realtimeStatus === 'connecting'
                    ? 'Sedang menghubungkan ke server real-time...'
                    : 'Koneksi real-time terputus. Klik Refresh untuk memuat ulang.'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Update terakhir: {lastUpdate.toLocaleTimeString('id-ID')}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button variant="outline" size="sm" onClick={() => fetchDashboardData()}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Anggota"
          value={stats.totalAnggota}
          icon={Users}
          description={`${stats.anggotaAktif} aktif`}
          tooltip="Jumlah semua anggota terdaftar di sistem RUKEM"
        />
        <StatCard
          title="KK Aktif (Valid)"
          value={stats.kkValid}
          icon={Home}
          description="Dapat mengikuti iuran"
          tooltip="KK yang memiliki Kepala Keluarga terdaftar. Hanya KK ini yang bisa mengikuti iuran dan santunan."
          iconClassName="bg-primary/10"
        />
        <StatCard
          title="Tagihan Bulan Ini"
          value={`${stats.totalLunas}/${stats.totalTagihanBulanIni}`}
          icon={Receipt}
          description="KK lunas dari total tagihan"
          tooltip="Tagihan dihitung dari KK Aktif (yang memiliki Kepala Keluarga)"
          iconClassName="bg-info/10"
        />
        <StatCard
          title="Saldo Kas"
          value={formatCurrency(stats.saldoKas)}
          icon={Wallet}
          tooltip="Total saldo kas RUKEM saat ini"
          iconClassName="bg-success/10"
        />
        <StatCard
          title="Menunggu Verifikasi"
          value={stats.pendingVerifikasi}
          icon={Clock}
          description="Pembayaran perlu diverifikasi"
          tooltip="Pembayaran yang sudah masuk tapi belum diverifikasi oleh admin"
          iconClassName="bg-warning/10"
        />
      </div>

      {/* Warning: KK Tanpa Kepala - dengan aksi langsung */}
      {dataIssues.kkTanpaKepala > 0 && (
        <div className="mt-6">
          <KKTanpaKepalaWarning 
            kkTanpaKepalaCount={dataIssues.kkTanpaKepala} 
            onDataChanged={fetchDashboardData}
          />
        </div>
      )}

      {/* Warning: Other Data Issues */}
      {(dataIssues.anggotaTanpaStatus > 0 || dataIssues.anggotaDataTidakLengkap > 0) && (
        <Alert variant="destructive" className="mt-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Ditemukan Data Bermasalah</AlertTitle>
          <AlertDescription className="mt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <ul className="list-disc list-inside text-sm space-y-1">
                {dataIssues.anggotaTanpaStatus > 0 && (
                  <li><span className="font-medium">{dataIssues.anggotaTanpaStatus} anggota</span> tidak memiliki status</li>
                )}
                {dataIssues.anggotaDataTidakLengkap > 0 && (
                  <li><span className="font-medium">{dataIssues.anggotaDataTidakLengkap} anggota</span> memiliki data tidak lengkap (termasuk status_dalam_kk)</li>
                )}
              </ul>
              <div className="flex gap-2 shrink-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/admin/migrasi-data')}
                >
                  <Database className="h-4 w-4 mr-2" />
                  Migrasi Data
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/admin/validasi-data')}
                >
                  Lihat Detail
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">
              Pembayaran Menunggu Verifikasi
            </CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <DataTable
              columns={paymentColumns}
              data={pendingPayments}
              emptyMessage="Tidak ada pembayaran menunggu verifikasi"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">
              Tagihan Terbaru
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <DataTable
              columns={tagihanColumns}
              data={recentTagihan}
              emptyMessage="Belum ada data tagihan"
            />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
