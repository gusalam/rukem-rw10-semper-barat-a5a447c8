import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
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
  PieChart as PieChartIcon,
  Home
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
  CartesianGrid,
  Tooltip,
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

const chartConfig = {
  terkumpul: {
    label: "Terkumpul",
    color: "hsl(var(--success))",
  },
  tagihan: {
    label: "Tagihan",
    color: "hsl(var(--primary))",
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
      
      const { data: anggotaData } = await supabase
        .from('anggota')
        .select('id, no_kk, rt, rw')
        .eq('status', 'aktif');
      
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

  const pieData = [
    { name: 'Belum Bayar', value: stats.tagihanBelumBayar, color: 'hsl(var(--destructive))' },
    { name: 'Menunggu', value: stats.tagihanMenungguAdmin, color: 'hsl(var(--warning))' },
    { name: 'Lunas', value: stats.tagihanLunas, color: 'hsl(var(--success))' },
  ].filter(d => d.value > 0);

  const totalTagihan = stats.tagihanBelumBayar + stats.tagihanMenungguAdmin + stats.tagihanLunas;

  if (loading) {
    return (
      <PenagihLayout title="Ringkasan">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PenagihLayout>
    );
  }

  return (
    <PenagihLayout title="Ringkasan">
      <div className="space-y-4">
        {/* Header Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <Home className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Ringkasan Statistik</h2>
                <p className="text-sm text-muted-foreground">Visualisasi data wilayah Anda</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {penagihWilayah.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">Belum Ada Wilayah</h3>
              <p className="text-muted-foreground">
                Anda belum ditugaskan ke wilayah manapun. Hubungi admin.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Wilayah Badge */}
            <div className="flex flex-wrap gap-2">
              {penagihWilayah.map((w, idx) => (
                <span 
                  key={idx}
                  className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium inline-flex items-center gap-1"
                >
                  <MapPin className="h-3 w-3" />
                  RT {w.rt} / RW {w.rw}
                </span>
              ))}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-destructive/20 bg-gradient-to-br from-destructive/5 to-destructive/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-destructive/20">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Belum Bayar</p>
                      <p className="font-bold text-lg">{stats.tagihanBelumBayar}</p>
                      <p className="text-xs text-destructive font-medium">{formatCurrency(stats.nominalBelumBayar)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-warning/20 bg-gradient-to-br from-warning/5 to-warning/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning/20">
                      <Clock className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Menunggu</p>
                      <p className="font-bold text-lg">{stats.tagihanMenungguAdmin}</p>
                      <p className="text-xs text-warning font-medium">{formatCurrency(stats.nominalMenungguAdmin)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-success/20 bg-gradient-to-br from-success/5 to-success/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/20">
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Lunas</p>
                      <p className="font-bold text-lg">{stats.tagihanLunas}</p>
                      <p className="text-xs text-success font-medium">{formatCurrency(stats.nominalLunas)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total KK</p>
                      <p className="font-bold text-lg">{stats.totalKK}</p>
                      <p className="text-xs text-primary font-medium">{stats.totalAnggota} anggota</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Collection Stats */}
            <div className="grid grid-cols-3 gap-2">
              <Card className="bg-success/5 border-success/20">
                <CardContent className="p-3 text-center">
                  <TrendingUp className="h-5 w-5 text-success mx-auto" />
                  <p className="text-sm font-bold text-success mt-1">{formatCurrency(stats.uangTerkumpulHariIni)}</p>
                  <p className="text-[10px] text-muted-foreground">Hari Ini</p>
                </CardContent>
              </Card>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-3 text-center">
                  <Calendar className="h-5 w-5 text-primary mx-auto" />
                  <p className="text-sm font-bold text-primary mt-1">{formatCurrency(stats.uangTerkumpulBulanIni)}</p>
                  <p className="text-[10px] text-muted-foreground">Bulan Ini</p>
                </CardContent>
              </Card>
              <Card className="bg-success/5 border-success/20">
                <CardContent className="p-3 text-center">
                  <Wallet className="h-5 w-5 text-success mx-auto" />
                  <p className="text-sm font-bold text-success mt-1">{formatCurrency(stats.totalPembayaranDisetujui)}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5" />
                  Tren 6 Bulan Terakhir
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[200px] w-full">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="bulan" 
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
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
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    Belum ada data
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PieChartIcon className="h-5 w-5" />
                  Distribusi Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {totalTagihan > 0 ? (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
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
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                      {pieData.map((entry, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <div 
                            className="w-2.5 h-2.5 rounded-full" 
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-xs text-muted-foreground">
                            {entry.name}: {entry.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-muted-foreground">
                    Belum ada data
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PenagihLayout>
  );
}
