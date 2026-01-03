import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AnggotaLayout } from '@/components/layout/AnggotaLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency, formatPeriode } from '@/lib/format';
import { 
  Receipt, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Wallet, 
  Bell, 
  TrendingUp, 
  Calendar,
  Users,
  History,
  User,
  HandHeart,
  Home,
} from 'lucide-react';
import type { IuranTagihan, Pengaturan, IuranPembayaran } from '@/types/database';

interface PembayaranWithTagihan extends IuranPembayaran {
  tagihan?: IuranTagihan;
}

// Quick action menu items
const quickActions = [
  { 
    icon: Receipt, 
    label: 'Tagihan Saya', 
    path: '/anggota/iuran',
    color: 'bg-blue-500',
    description: 'Lihat tagihan iuran',
  },
  { 
    icon: History, 
    label: 'Riwayat', 
    path: '/anggota/riwayat',
    color: 'bg-green-500',
    description: 'Riwayat pembayaran',
  },
  { 
    icon: Bell, 
    label: 'Notifikasi', 
    path: '/anggota/notifikasi',
    color: 'bg-orange-500',
    description: 'Pemberitahuan',
  },
  { 
    icon: User, 
    label: 'Profil', 
    path: '/anggota/profil',
    color: 'bg-purple-500',
    description: 'Data diri',
  },
];

export default function AnggotaDashboard() {
  const { anggota, user } = useAuth();
  const [tagihanList, setTagihanList] = useState<IuranTagihan[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);
  const [saldoKas, setSaldoKas] = useState(0);
  const [totalIuranDibayar, setTotalIuranDibayar] = useState(0);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [currentMonthStatus, setCurrentMonthStatus] = useState<'belum_bayar' | 'menunggu_admin' | 'lunas' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!anggota) return;
    
    try {
      // Get current month period (format: YYYY-MM)
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const [settingsRes, tagihanRes, kasRes, notifCountRes, pembayaranRes] = await Promise.all([
        supabase.from('pengaturan').select('*').limit(1).maybeSingle(),
        supabase
          .from('iuran_tagihan')
          .select('*')
          .eq('no_kk', anggota.no_kk)
          .order('periode', { ascending: false }),
        supabase.from('kas').select('jenis, nominal'),
        user ? supabase
          .from('notifikasi')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('dibaca', false) : Promise.resolve({ count: 0 }),
        // Get all approved payments for this KK
        supabase
          .from('iuran_pembayaran')
          .select('*, iuran_tagihan(*)')
          .eq('status', 'disetujui'),
      ]);
      
      setPengaturan(settingsRes.data as Pengaturan);
      
      const allTagihan = tagihanRes.data as IuranTagihan[] || [];
      setTagihanList(allTagihan.slice(0, 6));
      
      // Find current month status
      const currentMonthTagihan = allTagihan.find(t => t.periode === currentPeriod);
      setCurrentMonthStatus(currentMonthTagihan?.status as any || null);
      
      setUnreadNotif(notifCountRes.count || 0);
      
      // Calculate saldo kas
      const saldo = kasRes.data?.reduce((acc, k) => acc + (k.jenis === 'pemasukan' ? k.nominal : -k.nominal), 0) || 0;
      setSaldoKas(saldo);

      // Filter pembayaran for this KK and calculate total
      const pembayaranData = pembayaranRes.data || [];
      const kkTagihanIds = allTagihan.map(t => t.id);
      const kkPembayaran = pembayaranData.filter((p: any) => 
        kkTagihanIds.includes(p.tagihan_id)
      );
      
      // Calculate total paid
      const totalPaid = kkPembayaran.reduce((sum: number, p: any) => sum + p.nominal, 0);
      setTotalIuranDibayar(totalPaid);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [anggota, user]);

  useEffect(() => {
    if (anggota) {
      fetchData();
    }
  }, [anggota, fetchData]);

  // Real-time subscription untuk tagihan
  useEffect(() => {
    if (!anggota) return;

    const channel = supabase
      .channel('anggota-dashboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'iuran_tagihan',
          filter: `no_kk=eq.${anggota.no_kk}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [anggota, fetchData]);

  const belumBayar = tagihanList.filter(t => t.status === 'belum_bayar').length;
  const menunggu = tagihanList.filter(t => t.status === 'menunggu_admin').length;
  const lunas = tagihanList.filter(t => t.status === 'lunas').length;

  const nominalBelumBayar = tagihanList
    .filter(t => t.status === 'belum_bayar')
    .reduce((sum, t) => sum + t.nominal, 0);

  if (loading) {
    return (
      <AnggotaLayout showBackButton={false}>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </AnggotaLayout>
    );
  }

  return (
    <AnggotaLayout showBackButton={false}>
      <div className="space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold">
            Halo, {anggota?.nama_lengkap?.split(' ')[0] || 'Anggota'}!
          </h1>
          <p className="text-muted-foreground text-sm">
            Berikut ringkasan keanggotaan Anda
          </p>
        </div>

        {/* Status Iuran Bulan Ini - Prominent */}
        <Card className={`border-2 ${
          currentMonthStatus === 'lunas' ? 'border-green-500/50 bg-green-500/5' :
          currentMonthStatus === 'menunggu_admin' ? 'border-yellow-500/50 bg-yellow-500/5' :
          'border-red-500/50 bg-red-500/5'
        }`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${
                  currentMonthStatus === 'lunas' ? 'bg-green-500' :
                  currentMonthStatus === 'menunggu_admin' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}>
                  {currentMonthStatus === 'lunas' ? (
                    <CheckCircle className="h-6 w-6 text-white" />
                  ) : currentMonthStatus === 'menunggu_admin' ? (
                    <Clock className="h-6 w-6 text-white" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-white" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">Iuran {new Date().toLocaleDateString('id-ID', { month: 'long' })}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentMonthStatus === 'lunas' ? 'Sudah dibayar' :
                     currentMonthStatus === 'menunggu_admin' ? 'Menunggu verifikasi' :
                     'Belum dibayar'}
                  </p>
                </div>
              </div>
              <StatusBadge status={currentMonthStatus || 'belum_bayar'} />
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Iuran Saya</p>
                  <p className="font-bold text-sm">{formatCurrency(totalIuranDibayar)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-red-500/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Belum Bayar</p>
                  <p className="font-bold text-lg">{belumBayar}</p>
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                    {formatCurrency(nominalBelumBayar)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-yellow-500/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Menunggu</p>
                  <p className="font-bold text-lg">{menunggu}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Kas RUKEM</p>
                  <p className="font-bold text-sm">{formatCurrency(saldoKas)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Action Menu Grid */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Menu</h2>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <Link key={action.path} to={action.path}>
                <Card className="hover:shadow-md transition-all active:scale-95 cursor-pointer h-full">
                  <CardContent className="p-3 flex flex-col items-center justify-center text-center min-h-[90px]">
                    <div className={`p-2.5 rounded-xl ${action.color} mb-2`}>
                      <action.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs font-medium leading-tight">{action.label}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Tagihan Terkini */}
        {tagihanList.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  Tagihan Terkini
                </h3>
                <Link to="/anggota/iuran" className="text-xs text-primary font-medium">
                  Lihat Semua →
                </Link>
              </div>
              <div className="space-y-3">
                {tagihanList.slice(0, 3).map((tagihan) => (
                  <div
                    key={tagihan.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        tagihan.status === 'lunas' ? 'bg-green-500/10' :
                        tagihan.status === 'menunggu_admin' ? 'bg-yellow-500/10' :
                        'bg-red-500/10'
                      }`}>
                        {tagihan.status === 'lunas' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : tagihan.status === 'menunggu_admin' ? (
                          <Clock className="h-4 w-4 text-yellow-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{formatPeriode(tagihan.periode)}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(tagihan.nominal)}</p>
                      </div>
                    </div>
                    <StatusBadge status={tagihan.status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Pembayaran */}
        {pengaturan && (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Info Pembayaran
              </h3>
              <div className="space-y-2 text-sm">
                {pengaturan.nama_bank && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank</span>
                    <span className="font-medium">{pengaturan.nama_bank}</span>
                  </div>
                )}
                {pengaturan.nomor_rekening && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">No. Rekening</span>
                    <span className="font-medium font-mono">{pengaturan.nomor_rekening}</span>
                  </div>
                )}
                {pengaturan.nama_pemilik_rekening && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Atas Nama</span>
                    <span className="font-medium">{pengaturan.nama_pemilik_rekening}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Nominal Iuran</span>
                  <span className="font-bold text-primary">{formatCurrency(pengaturan.nominal_iuran)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                💡 Hubungi penagih wilayah Anda untuk melakukan pembayaran iuran.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AnggotaLayout>
  );
}
