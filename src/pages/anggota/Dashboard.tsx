import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AnggotaLayout } from '@/components/layout/AnggotaLayout';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { formatCurrency, formatPeriode, formatDate } from '@/lib/format';
import { Receipt, CheckCircle, Clock, AlertCircle, Wallet, Bell } from 'lucide-react';
import type { IuranTagihan, Pengaturan, Notifikasi } from '@/types/database';

export default function AnggotaDashboard() {
  const { anggota, user } = useAuth();
  const [tagihanList, setTagihanList] = useState<IuranTagihan[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([]);
  const [saldoKas, setSaldoKas] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!anggota) return;
    
    try {
      const [settingsRes, tagihanRes, kasRes, notifRes] = await Promise.all([
        supabase.from('pengaturan').select('*').limit(1).maybeSingle(),
        supabase
          .from('iuran_tagihan')
          .select('*')
          .eq('no_kk', anggota.no_kk)
          .order('jatuh_tempo', { ascending: false })
          .limit(6),
        supabase.from('kas').select('jenis, nominal'),
        user ? supabase
          .from('notifikasi')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5) : Promise.resolve({ data: [] }),
      ]);
      
      setPengaturan(settingsRes.data as Pengaturan);
      setTagihanList(tagihanRes.data as IuranTagihan[] || []);
      setNotifikasi(notifRes.data as Notifikasi[] || []);
      
      // Calculate saldo kas
      const saldo = kasRes.data?.reduce((acc, k) => acc + (k.jenis === 'pemasukan' ? k.nominal : -k.nominal), 0) || 0;
      setSaldoKas(saldo);
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

  // Real-time subscription untuk notifikasi baru
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifikasi-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifikasi',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notifikasi;
          setNotifikasi(prev => [newNotif, ...prev.slice(0, 4)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Real-time subscription untuk tagihan baru
  useEffect(() => {
    if (!anggota) return;

    const channel = supabase
      .channel('tagihan-changes')
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

  const markAsRead = async (notifId: string) => {
    await supabase.from('notifikasi').update({ dibaca: true }).eq('id', notifId);
    setNotifikasi(prev => prev.map(n => n.id === notifId ? { ...n, dibaca: true } : n));
  };

  const belumBayar = tagihanList.filter(t => t.status === 'belum_bayar').length;
  const menunggu = tagihanList.filter(t => t.status === 'menunggu_admin').length;
  const lunas = tagihanList.filter(t => t.status === 'lunas').length;
  const unreadNotif = notifikasi.filter(n => !n.dibaca).length;

  if (loading) {
    return (
      <AnggotaLayout>
        <PageHeader 
          title="Memuat..."
          description="Mohon tunggu sebentar"
        />
        <div className="mt-6">
          <DashboardSkeleton />
        </div>
      </AnggotaLayout>
    );
  }

  return (
    <AnggotaLayout>
      <PageHeader 
        title={`Halo, ${anggota?.nama_lengkap?.split(' ')[0] || 'Anggota'}!`}
        description="Berikut ringkasan keanggotaan Anda"
      />

      <div className="grid gap-4 md:grid-cols-4 mt-6">
        <StatCard
          title="Saldo Kas RUKEM"
          value={formatCurrency(saldoKas)}
          icon={Wallet}
          iconClassName="bg-primary/10"
        />
        <StatCard
          title="Belum Bayar"
          value={belumBayar}
          icon={AlertCircle}
          iconClassName="bg-warning/10"
        />
        <StatCard
          title="Menunggu Verifikasi"
          value={menunggu}
          icon={Clock}
          iconClassName="bg-info/10"
        />
        <StatCard
          title="Lunas"
          value={lunas}
          icon={CheckCircle}
          iconClassName="bg-success/10"
        />
      </div>

      {/* Notifikasi */}
      {notifikasi.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifikasi
              {unreadNotif > 0 && (
                <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">
                  {unreadNotif}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notifikasi.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                    notif.dibaca ? 'bg-card' : 'bg-primary/5 border-primary/20'
                  }`}
                  onClick={() => !notif.dibaca && markAsRead(notif.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`font-medium text-sm ${!notif.dibaca ? 'text-primary' : ''}`}>
                        {notif.judul}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">{notif.pesan}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(notif.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Tagihan Iuran</CardTitle>
        </CardHeader>
        <CardContent>
          {tagihanList.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Belum ada tagihan iuran</p>
          ) : (
            <div className="space-y-3">
              {tagihanList.map((tagihan) => (
                <div
                  key={tagihan.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                      <Receipt className="h-5 w-5 text-primary" />
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
          )}
        </CardContent>
      </Card>

      {pengaturan && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Informasi Pembayaran</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
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
            <p className="text-xs text-muted-foreground pt-2">
              Hubungi penagih wilayah Anda untuk melakukan pembayaran iuran.
            </p>
          </CardContent>
        </Card>
      )}
    </AnggotaLayout>
  );
}
