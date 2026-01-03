import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  AlertCircle, 
  TrendingUp, 
  Calendar, 
  MapPin, 
  CheckCircle, 
  Clock, 
  Wallet,
  BarChart3,
  PieChart as PieChartIcon
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface DashboardStats {
  totalKK: number;
  totalAnggota: number;
  tagihanBelumBayar: number;
  tagihanMenungguAdmin: number;
  tagihanLunas: number;
  nominalBelumBayar: number;
  nominalMenungguAdmin: number;
  nominalLunas: number;
  uangTerkumpulHariIni: number;
  uangTerkumpulBulanIni: number;
  totalPembayaranDisetujui: number;
}

interface MonthlyData {
  bulan: string;
  terkumpul: number;
  tagihan: number;
}

const COLORS = ['hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--success))'];

const chartConfig = {
  terkumpul: {
    label: "Terkumpul",
    color: "hsl(var(--success))",
  },
  tagihan: {
    label: "Tagihan",
    color: "hsl(var(--primary))",
  },
  belumBayar: {
    label: "Belum Bayar",
    color: "hsl(var(--destructive))",
  },
  menunggu: {
    label: "Menunggu",
    color: "hsl(var(--warning))",
  },
  lunas: {
    label: "Lunas",
    color: "hsl(var(--success))",
  },
};

export default function RingkasanPage() {
  const { user, penagihWilayah } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalKK: 0,
    totalAnggota: 0,
    tagihanBelumBayar: 0,
    tagihanMenungguAdmin: 0,
    tagihanLunas: 0,
    nominalBelumBayar: 0,
    nominalMenungguAdmin: 0,
    nominalLunas: 0,
    uangTerkumpulHariIni: 0,
    uangTerkumpulBulanIni: 0,
    totalPembayaranDisetujui: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
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
        .select('id, no_kk, rt, rw')
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
      let nominalLunas = 0;
      let uangTerkumpulHariIni = 0;
      let uangTerkumpulBulanIni = 0;
      let totalPembayaranDisetujui = 0;

      if (uniqueKKs.length > 0) {
        // Fetch tagihan
        const { data: tagihanData } = await supabase
          .from('iuran_tagihan')
          .select('*')
          .in('no_kk', uniqueKKs);

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
          nominalLunas = tagihanData
            .filter(t => t.status === 'lunas')
            .reduce((sum, t) => sum + t.nominal, 0);

          // Generate monthly data for chart (last 6 months)
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
          const now = new Date();
          const monthlyStats: MonthlyData[] = [];
          
          for (let i = 5; i >= 0; i--) {
            const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const targetPeriode = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
            
            const monthTagihan = tagihanData.filter(t => t.periode === targetPeriode);
            const monthLunas = monthTagihan.filter(t => t.status === 'lunas');
            
            monthlyStats.push({
              bulan: monthNames[targetDate.getMonth()],
              tagihan: monthTagihan.reduce((sum, t) => sum + t.nominal, 0),
              terkumpul: monthLunas.reduce((sum, t) => sum + t.nominal, 0),
            });
          }
          
          setMonthlyData(monthlyStats);
        }

        // Fetch pembayaran by this penagih
        const { data: pembayaranData } = await supabase
          .from('iuran_pembayaran')
          .select('*')
          .eq('penagih_user_id', user.id)
          .eq('status', 'disetujui');

        if (pembayaranData) {
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

          totalPembayaranDisetujui = pembayaranData.reduce((sum, p) => sum + p.nominal, 0);

          uangTerkumpulHariIni = pembayaranData
            .filter(p => new Date(p.approved_at || p.tanggal_bayar) >= new Date(todayStart))
            .reduce((sum, p) => sum + p.nominal, 0);
          
          uangTerkumpulBulanIni = pembayaranData
            .filter(p => new Date(p.approved_at || p.tanggal_bayar) >= new Date(monthStart))
            .reduce((sum, p) => sum + p.nominal, 0);
        }
      }

      setStats({
        totalKK: uniqueKKs.length,
        totalAnggota: filteredAnggota.length,
        tagihanBelumBayar,
        tagihanMenungguAdmin,
        tagihanLunas,
        nominalBelumBayar,
        nominalMenungguAdmin,
        nominalLunas,
        uangTerkumpulHariIni,
        uangTerkumpulBulanIni,
        totalPembayaranDisetujui,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, penagihWilayah]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('penagih-ringkasan-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iuran_pembayaran' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iuran_tagihan' }, () => fetchStats())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchStats]);

  // Pie chart data
  const pieData = [
    { name: 'Belum Bayar', value: stats.tagihanBelumBayar, color: 'hsl(var(--destructive))' },
    { name: 'Menunggu', value: stats.tagihanMenungguAdmin, color: 'hsl(var(--warning))' },
    { name: 'Lunas', value: stats.tagihanLunas, color: 'hsl(var(--success))' },
  ].filter(d => d.value > 0);

  const totalTagihan = stats.tagihanBelumBayar + stats.tagihanMenungguAdmin + stats.tagihanLunas;

  if (loading) {
    return (
      <PenagihLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </PenagihLayout>
    );
  }

  return (
    <PenagihLayout>
      <PageHeader 
        title="Ringkasan" 
        description="Statistik lengkap dan visualisasi data wilayah Anda"
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
        <div className="space-y-6">
          {/* Wilayah Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
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

          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              iconClassName="bg-destructive/10"
            />
            <StatCard
              title="Menunggu Verifikasi"
              value={stats.tagihanMenungguAdmin}
              icon={Clock}
              description={formatCurrency(stats.nominalMenungguAdmin)}
              className="border-warning/20"
              iconClassName="bg-warning/10"
            />
            <StatCard
              title="Lunas"
              value={stats.tagihanLunas}
              icon={CheckCircle}
              description={formatCurrency(stats.nominalLunas)}
              className="border-success/20"
              iconClassName="bg-success/10"
            />
          </div>

          {/* Collection Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Terkumpul Hari Ini"
              value={formatCurrency(stats.uangTerkumpulHariIni)}
              icon={TrendingUp}
              description="Sudah disetujui admin"
              className="border-success/20"
              iconClassName="bg-success/10"
            />
            <StatCard
              title="Terkumpul Bulan Ini"
              value={formatCurrency(stats.uangTerkumpulBulanIni)}
              icon={Calendar}
              description="Sudah disetujui admin"
              className="border-primary/20"
              iconClassName="bg-primary/10"
            />
            <StatCard
              title="Total Terkumpul"
              value={formatCurrency(stats.totalPembayaranDisetujui)}
              icon={Wallet}
              description="Sepanjang waktu"
              className="border-success/20 bg-success/5"
              iconClassName="bg-success/10"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart - Monthly Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5" />
                  Tren Tagihan 6 Bulan Terakhir
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="bulan" 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${(value / 1000000).toFixed(0)}jt`}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />} 
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar 
                        dataKey="tagihan" 
                        fill="var(--color-tagihan)" 
                        radius={[4, 4, 0, 0]} 
                        name="Tagihan"
                      />
                      <Bar 
                        dataKey="terkumpul" 
                        fill="var(--color-terkumpul)" 
                        radius={[4, 4, 0, 0]} 
                        name="Terkumpul"
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                    Belum ada data tagihan
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pie Chart - Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PieChartIcon className="h-5 w-5" />
                  Distribusi Status Tagihan
                </CardTitle>
              </CardHeader>
              <CardContent>
                {totalTagihan > 0 ? (
                  <div className="h-[280px] flex flex-col items-center justify-center">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            `${value} tagihan`,
                            name
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-4 mt-4">
                      {pieData.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-sm text-muted-foreground">
                            {entry.name}: {entry.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                    Belum ada data tagihan
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Performance Summary */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <p className="text-3xl font-bold text-primary">{stats.totalKK}</p>
                  <p className="text-sm text-muted-foreground">KK Dikelola</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-destructive">{stats.tagihanBelumBayar}</p>
                  <p className="text-sm text-muted-foreground">Belum Bayar</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-warning">{stats.tagihanMenungguAdmin}</p>
                  <p className="text-sm text-muted-foreground">Menunggu Verifikasi</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-success">{stats.tagihanLunas}</p>
                  <p className="text-sm text-muted-foreground">Sudah Lunas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PenagihLayout>
  );
}