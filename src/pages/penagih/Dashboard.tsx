import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Receipt, Clock, CheckCircle, MapPin } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface DashboardStats {
  totalAnggota: number;
  totalKK: number;
  tagihanBelumBayar: number;
  tagihanMenungguAdmin: number;
  nominalBelumBayar: number;
}

export default function PenagihDashboard() {
  const { user, penagihWilayah } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalAnggota: 0,
    totalKK: 0,
    tagihanBelumBayar: 0,
    tagihanMenungguAdmin: 0,
    nominalBelumBayar: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (penagihWilayah.length > 0) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [penagihWilayah]);

  const fetchStats = async () => {
    try {
      // Get RT/RW pairs for the penagih
      const rtRwPairs = penagihWilayah.map(w => ({ rt: w.rt, rw: w.rw }));
      
      // Build OR conditions for each RT/RW pair
      let anggotaQuery = supabase
        .from('anggota')
        .select('id, no_kk, rt, rw')
        .eq('status', 'aktif');

      // Get anggota in penagih wilayah
      const { data: anggotaData } = await anggotaQuery;
      
      // Filter by penagih wilayah
      const filteredAnggota = anggotaData?.filter(a => 
        rtRwPairs.some(pair => pair.rt === a.rt && pair.rw === a.rw)
      ) || [];

      const uniqueKKs = [...new Set(filteredAnggota.map(a => a.no_kk))];

      // Get tagihan for these KKs
      let tagihanBelumBayar = 0;
      let tagihanMenungguAdmin = 0;
      let nominalBelumBayar = 0;

      if (uniqueKKs.length > 0) {
        const { data: tagihanData } = await supabase
          .from('iuran_tagihan')
          .select('*')
          .in('no_kk', uniqueKKs);

        if (tagihanData) {
          tagihanBelumBayar = tagihanData.filter(t => t.status === 'belum_bayar').length;
          tagihanMenungguAdmin = tagihanData.filter(t => t.status === 'menunggu_admin').length;
          nominalBelumBayar = tagihanData
            .filter(t => t.status === 'belum_bayar')
            .reduce((sum, t) => sum + t.nominal, 0);
        }
      }

      setStats({
        totalAnggota: filteredAnggota.length,
        totalKK: uniqueKKs.length,
        tagihanBelumBayar,
        tagihanMenungguAdmin,
        nominalBelumBayar,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Total Anggota"
              value={stats.totalAnggota}
              icon={Users}
              description="di wilayah Anda"
            />
            <StatCard
              title="Total KK"
              value={stats.totalKK}
              icon={Users}
              description="Kartu Keluarga"
            />
            <StatCard
              title="Belum Bayar"
              value={stats.tagihanBelumBayar}
              icon={Receipt}
              description="tagihan"
            />
            <StatCard
              title="Menunggu Admin"
              value={stats.tagihanMenungguAdmin}
              icon={Clock}
              description="pembayaran"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ringkasan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Tagihan Belum Dibayar</span>
                  <span className="font-bold text-lg">{formatCurrency(stats.nominalBelumBayar)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </PenagihLayout>
  );
}
