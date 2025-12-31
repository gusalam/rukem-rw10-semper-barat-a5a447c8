import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Users, Receipt, Clock, CheckCircle, MapPin, AlertCircle, CreditCard } from 'lucide-react';
import { formatCurrency, formatPeriode, formatDate } from '@/lib/format';
import { Link } from 'react-router-dom';
import type { IuranTagihan, Anggota } from '@/types/database';

interface TagihanWithKK extends IuranTagihan {
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
  });
  const [recentTagihan, setRecentTagihan] = useState<TagihanWithKK[]>([]);
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

      // Get tagihan for these KKs
      let tagihanBelumBayar = 0;
      let tagihanMenungguAdmin = 0;
      let tagihanLunas = 0;
      let nominalBelumBayar = 0;
      let nominalMenungguAdmin = 0;
      let recentTagihanList: TagihanWithKK[] = [];

      if (uniqueKKs.length > 0) {
        const { data: tagihanData } = await supabase
          .from('iuran_tagihan')
          .select('*')
          .in('no_kk', uniqueKKs)
          .order('jatuh_tempo', { ascending: true });

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

          // Get recent unpaid tagihan (limit 5)
          recentTagihanList = tagihanData
            .filter(t => t.status === 'belum_bayar')
            .slice(0, 5)
            .map(t => {
              const kepala = filteredAnggota.find(a => 
                a.no_kk === t.no_kk && a.hubungan_kk === 'Kepala Keluarga'
              ) || filteredAnggota.find(a => a.no_kk === t.no_kk);
              return { ...t, kepala_keluarga: kepala as Anggota } as TagihanWithKK;
            });
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
      });
      setRecentTagihan(recentTagihanList);
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
              icon={AlertCircle}
              description={formatCurrency(stats.nominalBelumBayar)}
              className="border-destructive/20"
            />
            <StatCard
              title="Menunggu Admin"
              value={stats.tagihanMenungguAdmin}
              icon={Clock}
              description={formatCurrency(stats.nominalMenungguAdmin)}
              className="border-yellow-500/20"
            />
          </div>

          {/* Ringkasan & Tagihan Terbaru */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ringkasan */}
            <Card>
              <CardHeader>
                <CardTitle>Ringkasan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-destructive/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      <span>Tagihan Belum Dibayar</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatCurrency(stats.nominalBelumBayar)}</p>
                      <p className="text-xs text-muted-foreground">{stats.tagihanBelumBayar} tagihan</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-yellow-500/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-yellow-600" />
                      <span>Menunggu Verifikasi Admin</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatCurrency(stats.nominalMenungguAdmin)}</p>
                      <p className="text-xs text-muted-foreground">{stats.tagihanMenungguAdmin} tagihan</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span>Sudah Lunas</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{stats.tagihanLunas}</p>
                      <p className="text-xs text-muted-foreground">tagihan</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tagihan Terbaru */}
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
                {recentTagihan.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                    <p>Semua tagihan sudah dibayar!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentTagihan.map((tagihan) => (
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
                          <StatusBadge status={tagihan.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Action */}
          <Card className="mt-6">
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
        </>
      )}
    </PenagihLayout>
  );
}
