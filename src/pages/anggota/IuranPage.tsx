import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AnggotaLayout } from '@/components/layout/AnggotaLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { IuranPageSkeleton } from '@/components/ui/loading-skeleton';
import { Receipt, CreditCard, CheckCircle, Clock, AlertCircle, Users } from 'lucide-react';
import type { IuranTagihan, Pengaturan } from '@/types/database';
import { formatCurrency, formatPeriode, formatDate } from '@/lib/format';

interface TagihanWithPembayaran extends IuranTagihan {
  pembayaran?: {
    status: string;
    tanggal_bayar: string;
    metode: string;
  }[];
}

export default function AnggotaIuranPage() {
  const { anggota } = useAuth();
  const [tagihanList, setTagihanList] = useState<TagihanWithPembayaran[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);
  const [keluargaList, setKeluargaList] = useState<{ nama_lengkap: string; hubungan_kk: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!anggota) return;
    
    try {
      const [tagihanRes, pengaturanRes, keluargaRes] = await Promise.all([
        supabase
          .from('iuran_tagihan')
          .select(`
            *,
            iuran_pembayaran (
              status,
              tanggal_bayar,
              metode
            )
          `)
          .eq('no_kk', anggota.no_kk)
          .order('jatuh_tempo', { ascending: false }),
        supabase.from('pengaturan').select('*').limit(1).maybeSingle(),
        supabase
          .from('anggota')
          .select('nama_lengkap, hubungan_kk')
          .eq('no_kk', anggota.no_kk)
          .eq('status', 'aktif'),
      ]);

      const tagihanData = (tagihanRes.data || []).map(t => ({
        ...t,
        pembayaran: t.iuran_pembayaran || [],
      }));
      
      setTagihanList(tagihanData as TagihanWithPembayaran[]);
      setPengaturan(pengaturanRes.data as Pengaturan);
      setKeluargaList(keluargaRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [anggota]);

  useEffect(() => {
    if (anggota) {
      fetchData();
    }
  }, [anggota, fetchData]);

  // Real-time subscription
  useEffect(() => {
    if (!anggota) return;

    const channel = supabase
      .channel('tagihan-iuran-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'iuran_tagihan',
          filter: `no_kk=eq.${anggota.no_kk}`,
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [anggota, fetchData]);

  // Summary calculations
  const totalTagihan = tagihanList.reduce((acc, t) => acc + t.nominal, 0);
  const totalLunas = tagihanList.filter(t => t.status === 'lunas').reduce((acc, t) => acc + t.nominal, 0);
  const totalBelumBayar = tagihanList.filter(t => t.status === 'belum_bayar').reduce((acc, t) => acc + t.nominal, 0);
  const totalMenunggu = tagihanList.filter(t => t.status === 'menunggu_admin').reduce((acc, t) => acc + t.nominal, 0);

  if (loading) {
    return (
      <AnggotaLayout>
        <PageHeader title="Tagihan Iuran" description="Status tagihan iuran untuk KK Anda" />
        <div className="mt-6">
          <IuranPageSkeleton />
        </div>
      </AnggotaLayout>
    );
  }

  return (
    <AnggotaLayout>
      <PageHeader title="Tagihan Iuran" description={`Status tagihan iuran untuk KK: ${anggota?.no_kk}`} />

      {/* Family Info Card */}
      <Card className="mt-6 bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <span className="font-semibold">Anggota Keluarga ({keluargaList.length} orang)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {keluargaList.map((member, idx) => (
              <div key={idx} className="px-3 py-1 bg-background rounded-full text-sm border">
                {member.nama_lengkap} 
                {member.hubungan_kk === 'Kepala Keluarga' && (
                  <span className="ml-1 text-xs text-primary font-medium">(KK)</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground bg-info/10 p-3 rounded-lg">
            ℹ️ Pembayaran iuran dilakukan melalui penagih wilayah Anda. Hubungi penagih untuk melakukan pembayaran.
          </p>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mt-6">
        <StatCard
          title="Total Tagihan"
          value={formatCurrency(totalTagihan)}
          icon={Receipt}
        />
        <StatCard
          title="Sudah Lunas"
          value={formatCurrency(totalLunas)}
          icon={CheckCircle}
          iconClassName="bg-success/10"
        />
        <StatCard
          title="Menunggu Verifikasi"
          value={formatCurrency(totalMenunggu)}
          icon={Clock}
          iconClassName="bg-info/10"
        />
        <StatCard
          title="Belum Dibayar"
          value={formatCurrency(totalBelumBayar)}
          icon={AlertCircle}
          iconClassName="bg-warning/10"
        />
      </div>

      {/* Payment Info Card */}
      {pengaturan && (
        <Card className="mt-6 bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="h-5 w-5 text-primary" />
              <span className="font-semibold">Informasi Pembayaran</span>
            </div>
            <div className="grid gap-2 text-sm">
              {pengaturan.nama_bank && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bank</span>
                  <span className="font-medium">{pengaturan.nama_bank}</span>
                </div>
              )}
              {pengaturan.nomor_rekening && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No. Rekening</span>
                  <span className="font-mono font-medium">{pengaturan.nomor_rekening}</span>
                </div>
              )}
              {pengaturan.nama_pemilik_rekening && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Atas Nama</span>
                  <span className="font-medium">{pengaturan.nama_pemilik_rekening}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t mt-2">
                <span className="text-muted-foreground">Nominal Iuran per Bulan</span>
                <span className="font-bold text-primary">{formatCurrency(pengaturan.nominal_iuran)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tagihan List */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Daftar Tagihan</CardTitle>
        </CardHeader>
        <CardContent>
          {tagihanList.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Belum ada tagihan"
              description="Data tagihan iuran Anda akan muncul di sini"
            />
          ) : (
            <div className="space-y-3">
              {tagihanList.map((tagihan) => {
                const lastPembayaran = tagihan.pembayaran?.[0];
                
                return (
                  <div key={tagihan.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                        <Receipt className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{formatPeriode(tagihan.periode)}</p>
                        <p className="text-sm text-muted-foreground">
                          Jatuh tempo: {formatDate(tagihan.jatuh_tempo)}
                        </p>
                        {lastPembayaran && (
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs capitalize">
                              {lastPembayaran.metode}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(lastPembayaran.tanggal_bayar)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <p className="font-bold text-primary">{formatCurrency(tagihan.nominal)}</p>
                      <StatusBadge status={tagihan.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </AnggotaLayout>
  );
}
