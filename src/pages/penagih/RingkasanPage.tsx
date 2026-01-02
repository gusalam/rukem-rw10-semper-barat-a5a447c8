import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, AlertCircle, TrendingUp, Calendar, MapPin } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface DashboardStats {
  totalKK: number;
  totalAnggota: number;
  tagihanAktif: number;
  nominalTagihanAktif: number;
  uangTerkumpulHariIni: number;
  uangTerkumpulBulanIni: number;
}

export default function RingkasanPage() {
  const { user, penagihWilayah } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalKK: 0,
    totalAnggota: 0,
    tagihanAktif: 0,
    nominalTagihanAktif: 0,
    uangTerkumpulHariIni: 0,
    uangTerkumpulBulanIni: 0,
  });
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

      let tagihanAktif = 0;
      let nominalTagihanAktif = 0;
      let uangTerkumpulHariIni = 0;
      let uangTerkumpulBulanIni = 0;

      if (uniqueKKs.length > 0) {
        // Fetch tagihan
        const { data: tagihanData } = await supabase
          .from('iuran_tagihan')
          .select('*')
          .in('no_kk', uniqueKKs)
          .eq('status', 'belum_bayar');

        if (tagihanData) {
          tagihanAktif = tagihanData.length;
          nominalTagihanAktif = tagihanData.reduce((sum, t) => sum + t.nominal, 0);
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
        tagihanAktif,
        nominalTagihanAktif,
        uangTerkumpulHariIni,
        uangTerkumpulBulanIni,
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

  if (loading) {
    return (
      <PenagihLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </PenagihLayout>
    );
  }

  return (
    <PenagihLayout>
      <PageHeader 
        title="Ringkasan" 
        description="Ikhtisar data wilayah Anda"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard
              title="Total KK"
              value={stats.totalKK}
              icon={Users}
              description={`${stats.totalAnggota} anggota`}
            />
            <StatCard
              title="Tagihan Aktif"
              value={stats.tagihanAktif}
              icon={AlertCircle}
              description={formatCurrency(stats.nominalTagihanAktif)}
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
        </>
      )}
    </PenagihLayout>
  );
}
