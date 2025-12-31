import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMultiRealtime } from '@/hooks/use-realtime';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { AdminDashboardSkeleton } from '@/components/ui/admin-loading-skeleton';
import { formatCurrency, formatDate } from '@/lib/format';
import { Users, Receipt, Wallet, AlertCircle, TrendingUp, Clock, RefreshCw, Home } from 'lucide-react';
import type { Iuran, PembayaranIuran } from '@/types/database';

interface DashboardStats {
  totalAnggota: number;
  totalKK: number;
  anggotaAktif: number;
  totalIuranBulanIni: number;
  totalLunas: number;
  saldoKas: number;
  pendingVerifikasi: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAnggota: 0,
    totalKK: 0,
    anggotaAktif: 0,
    totalIuranBulanIni: 0,
    totalLunas: 0,
    saldoKas: 0,
    pendingVerifikasi: 0,
  });
  const [pendingPayments, setPendingPayments] = useState<PembayaranIuran[]>([]);
  const [recentIuran, setRecentIuran] = useState<Iuran[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLive, setIsLive] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch anggota stats
      const { data: anggotaData, count: totalAnggota } = await supabase
        .from('anggota')
        .select('*', { count: 'exact' });

      const anggotaAktif = anggotaData?.filter(a => a.status === 'aktif').length || 0;
      
      // Count unique KK numbers
      const uniqueKK = new Set(anggotaData?.map(a => a.no_kk) || []);
      const totalKK = uniqueKK.size;

      // Fetch current month iuran (now per KK)
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: iuranData } = await supabase
        .from('iuran')
        .select('*')
        .like('periode', `${currentMonth}%`);

      // Count unique KK iuran
      const totalIuranBulanIni = iuranData?.length || 0;
      const totalLunas = iuranData?.filter(i => i.status === 'lunas').length || 0;

      // Fetch kas balance
      const { data: kasData } = await supabase.from('kas').select('jenis, nominal');
      const saldoKas = kasData?.reduce((acc, k) => {
        return acc + (k.jenis === 'pemasukan' ? k.nominal : -k.nominal);
      }, 0) || 0;

      // Fetch pending verifications
      const { data: pendingData, count: pendingCount } = await supabase
        .from('pembayaran_iuran')
        .select('*, iuran(*), anggota(*)', { count: 'exact' })
        .is('verified_at', null)
        .is('alasan_tolak', null)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch recent iuran
      const { data: recentData } = await supabase
        .from('iuran')
        .select('*, anggota(*)')
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        totalAnggota: totalAnggota || 0,
        totalKK,
        anggotaAktif,
        totalIuranBulanIni,
        totalLunas,
        saldoKas,
        pendingVerifikasi: pendingCount || 0,
      });
      setPendingPayments(pendingData as PembayaranIuran[] || []);
      setRecentIuran(recentData as Iuran[] || []);
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
    ['pembayaran_iuran', 'iuran', 'kas', 'anggota'],
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
      key: 'anggota',
      header: 'Anggota',
      cell: (item: PembayaranIuran) => item.anggota?.nama_lengkap || '-',
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: PembayaranIuran) => formatCurrency(item.nominal),
    },
    {
      key: 'tanggal_bayar',
      header: 'Tanggal',
      cell: (item: PembayaranIuran) => formatDate(item.tanggal_bayar),
    },
  ];

  const iuranColumns = [
    {
      key: 'anggota',
      header: 'Anggota',
      cell: (item: Iuran) => item.anggota?.nama_lengkap || '-',
    },
    {
      key: 'periode',
      header: 'Periode',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: Iuran) => <StatusBadge status={item.status} />,
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
          title="Iuran Bulan Ini"
          value={`${stats.totalLunas}/${stats.totalIuranBulanIni}`}
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

      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">
              Pembayaran Menunggu Verifikasi
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-warning" />
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
              Iuran Terbaru
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <DataTable
              columns={iuranColumns}
              data={recentIuran}
              emptyMessage="Belum ada data iuran"
            />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
