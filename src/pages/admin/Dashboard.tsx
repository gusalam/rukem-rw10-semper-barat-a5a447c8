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
import { formatCurrency, formatDate, formatPeriode } from '@/lib/format';
import { Users, Receipt, Wallet, Clock, RefreshCw, Home, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import type { IuranTagihan, IuranPembayaran, Anggota } from '@/types/database';

interface DashboardStats {
  totalAnggota: number;
  totalKK: number;
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

      // Count KK unik dari anggota aktif
      const { data: kkData } = await supabase
        .from('anggota')
        .select('no_kk')
        .eq('status', 'aktif');
      const uniqueKK = new Set(kkData?.map(a => a.no_kk) || []);
      const totalKK = uniqueKK.size;

      // === DETEKSI DATA BERMASALAH ===
      // Fetch KK dengan Kepala Keluarga untuk validasi
      const { data: kepalaData } = await supabase
        .from('anggota')
        .select('no_kk')
        .eq('status', 'aktif')
        .eq('hubungan_kk', 'Kepala Keluarga');
      const kkWithKepala = new Set(kepalaData?.map(a => a.no_kk) || []);
      const kkTanpaKepala = [...uniqueKK].filter(kk => !kkWithKepala.has(kk)).length;

      // Count anggota tanpa status (null)
      const { count: anggotaTanpaStatus } = await supabase
        .from('anggota')
        .select('*', { count: 'exact', head: true })
        .is('status', null);

      // Count anggota dengan data tidak lengkap
      const { data: incompleteData } = await supabase
        .from('anggota')
        .select('id, nik, no_kk, nama_lengkap, alamat, no_hp, hubungan_kk');
      const anggotaDataTidakLengkap = incompleteData?.filter(a => 
        !a.nik || !a.no_kk || !a.nama_lengkap || !a.alamat || !a.no_hp || !a.hubungan_kk
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
        anggotaAktif: countAnggotaAktif || 0,
        totalTagihanBulanIni,
        totalLunas,
        saldoKas,
        pendingVerifikasi: pendingCount || 0,
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

  // Realtime subscriptions - auto refresh when any of these tables change
  useMultiRealtime(
    ['iuran_pembayaran', 'iuran_tagihan', 'kas', 'anggota'],
    useCallback(() => {
      console.log('[Dashboard] Realtime update detected, refreshing...');
      setIsLive(true);
      fetchDashboardData();
      // Reset live indicator after 2 seconds
      setTimeout(() => setIsLive(false), 2000);
    }, [fetchDashboardData])
  );

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
        <div className="flex items-center gap-2">
          {isLive && (
            <Badge variant="outline" className="animate-pulse bg-success/10 text-success border-success/30">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Live
            </Badge>
          )}
          <Badge variant="secondary" className="font-normal text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {lastUpdate.toLocaleTimeString('id-ID')}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Anggota"
          value={stats.totalAnggota}
          icon={Users}
          description={`${stats.anggotaAktif} aktif`}
        />
        <StatCard
          title="Total KK"
          value={stats.totalKK}
          icon={Home}
          description="Kartu Keluarga"
          iconClassName="bg-primary/10"
        />
        <StatCard
          title="Tagihan Bulan Ini"
          value={`${stats.totalLunas}/${stats.totalTagihanBulanIni}`}
          icon={Receipt}
          description="KK lunas dari total tagihan"
          iconClassName="bg-info/10"
        />
        <StatCard
          title="Saldo Kas"
          value={formatCurrency(stats.saldoKas)}
          icon={Wallet}
          iconClassName="bg-success/10"
        />
        <StatCard
          title="Menunggu Verifikasi"
          value={stats.pendingVerifikasi}
          icon={Clock}
          description="Pembayaran perlu diverifikasi"
          iconClassName="bg-warning/10"
        />
      </div>

      {/* Warning: Data Issues */}
      {(dataIssues.kkTanpaKepala > 0 || dataIssues.anggotaTanpaStatus > 0 || dataIssues.anggotaDataTidakLengkap > 0) && (
        <Alert variant="destructive" className="mt-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Ditemukan Data Bermasalah</AlertTitle>
          <AlertDescription className="mt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <ul className="list-disc list-inside text-sm space-y-1">
                {dataIssues.kkTanpaKepala > 0 && (
                  <li><span className="font-medium">{dataIssues.kkTanpaKepala} KK</span> tidak memiliki Kepala Keluarga</li>
                )}
                {dataIssues.anggotaTanpaStatus > 0 && (
                  <li><span className="font-medium">{dataIssues.anggotaTanpaStatus} anggota</span> tidak memiliki status</li>
                )}
                {dataIssues.anggotaDataTidakLengkap > 0 && (
                  <li><span className="font-medium">{dataIssues.anggotaDataTidakLengkap} anggota</span> memiliki data tidak lengkap</li>
                )}
              </ul>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/admin/validasi-data')}
                className="shrink-0"
              >
                Lihat Detail
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
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
