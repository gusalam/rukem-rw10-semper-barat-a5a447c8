import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NetworkStatus } from '@/components/ui/network-status';
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  MapPin, 
  AlertCircle, 
  TrendingUp, 
  Calendar,
  Receipt,
  CreditCard,
  Wallet,
  User,
  LogOut,
  Home,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { Link } from 'react-router-dom';
import type { Anggota } from '@/types/database';

interface DashboardStats {
  totalAnggota: number;
  totalKK: number;
  tagihanBelumBayar: number;
  tagihanMenungguAdmin: number;
  tagihanLunas: number;
  nominalBelumBayar: number;
  nominalMenungguAdmin: number;
  uangTerkumpulHariIni: number;
  uangTerkumpulBulanIni: number;
  totalPembayaranDisetujui: number;
}

// Quick action menu items with icons
const quickActions = [
  { 
    icon: Home, 
    label: 'Ringkasan', 
    path: '/penagih/ringkasan',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-500',
  },
  { 
    icon: Receipt, 
    label: 'Riwayat Tagihan', 
    path: '/penagih/riwayat-tagihan',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    iconBg: 'bg-orange-500',
  },
  { 
    icon: CreditCard, 
    label: 'Input Pembayaran', 
    path: '/penagih/input-pembayaran',
    color: 'bg-green-500/10 text-green-600 dark:text-green-400',
    iconBg: 'bg-green-500',
  },
  { 
    icon: Wallet, 
    label: 'Rekap Uang', 
    path: '/penagih/rekap-uang',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    iconBg: 'bg-purple-500',
  },
  { 
    icon: Users, 
    label: 'Anggota Wilayah', 
    path: '/penagih/anggota',
    color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    iconBg: 'bg-cyan-500',
  },
  { 
    icon: User, 
    label: 'Profil', 
    path: '/penagih/profil',
    color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    iconBg: 'bg-pink-500',
  },
];

export default function PenagihDashboard() {
  const { user, penagihWilayah, signOut } = useAuth();
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
  const [loading, setLoading] = useState(true);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const wilayahText = penagihWilayah.length > 0
    ? penagihWilayah.map(w => `RT ${w.rt}/RW ${w.rw}`).join(', ')
    : 'Belum ada wilayah';

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
        }

        if (pembayaranData) {
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

          // Count pending payments (menunggu_admin) - these are payments waiting for admin approval
          const pendingPayments = pembayaranData.filter((p: any) => p.status === 'menunggu_admin');
          tagihanMenungguAdmin = pendingPayments.length;
          nominalMenungguAdmin = pendingPayments.reduce((sum: number, p: any) => sum + p.nominal, 0);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4 space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Portal Penagih</h1>
              <p className="text-xs text-muted-foreground">{wilayahText}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => setLogoutDialogOpen(true)}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6 pb-8">
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
            {/* Quick Stats Cards */}
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
                      <TrendingUp className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Hari Ini</p>
                      <p className="font-bold text-sm">{formatCurrency(stats.uangTerkumpulHariIni)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Bulan Ini</p>
                      <p className="font-bold text-sm">{formatCurrency(stats.uangTerkumpulBulanIni)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Info Stats */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/20">
                      <Users className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Total KK di Wilayah</p>
                      <p className="text-xs text-muted-foreground">{stats.totalAnggota} anggota</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{stats.totalKK}</p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Action Grid */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Menu</h2>
              <div className="grid grid-cols-3 gap-3">
                {quickActions.map((action) => (
                  <Link key={action.path} to={action.path}>
                    <Card className="hover:shadow-md transition-all active:scale-95 cursor-pointer h-full">
                      <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                        <div className={`p-3 rounded-xl ${action.iconBg} mb-2`}>
                          <action.icon className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-xs font-medium leading-tight">{action.label}</span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>

            {/* Summary Card */}
            <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-success">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Total Terkumpul</p>
                      <p className="text-xs text-muted-foreground">{stats.tagihanLunas} tagihan lunas</p>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-success">{formatCurrency(stats.totalPembayaranDisetujui)}</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <NetworkStatus />
      
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={signOut}
      />
    </div>
  );
}
