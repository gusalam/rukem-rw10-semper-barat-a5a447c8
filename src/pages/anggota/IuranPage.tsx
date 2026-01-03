import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AnggotaLayout } from '@/components/layout/AnggotaLayout';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt, CreditCard, CheckCircle, Clock, AlertCircle, Wallet } from 'lucide-react';
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
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </AnggotaLayout>
    );
  }

  return (
    <AnggotaLayout title="Tagihan Iuran">
      <div className="space-y-4">
        {/* Summary Header Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <Receipt className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Iuran KK</h2>
                <p className="text-sm text-muted-foreground font-mono">{anggota?.no_kk}</p>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-background/50">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Tagihan</span>
                <span className="text-2xl font-bold text-primary">{formatCurrency(totalTagihan)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-success/5 border-success/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-lg font-bold text-success">{formatCurrency(totalLunas)}</p>
                  <p className="text-xs text-muted-foreground">Lunas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-warning/5 border-warning/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <AlertCircle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-lg font-bold text-warning">{formatCurrency(totalBelumBayar)}</p>
                  <p className="text-xs text-muted-foreground">Belum Bayar</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {totalMenunggu > 0 && (
          <Card className="bg-info/5 border-info/20">
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-info" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Menunggu Verifikasi</p>
                </div>
                <p className="font-bold text-info">{formatCurrency(totalMenunggu)}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Info */}
        {pengaturan && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <span className="font-semibold">Info Pembayaran</span>
              </div>
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
                    <span className="font-mono font-medium">{pengaturan.nomor_rekening}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t mt-2">
                  <span className="text-muted-foreground">Iuran per Bulan</span>
                  <span className="font-bold text-primary">{formatCurrency(pengaturan.nominal_iuran)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Banner */}
        <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          ℹ️ Pembayaran dilakukan melalui penagih wilayah. Hubungi penagih untuk melakukan pembayaran.
        </div>

        {/* Tagihan List */}
        <div className="space-y-3">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Daftar Tagihan
          </h3>

          {tagihanList.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Belum ada tagihan"
              description="Data tagihan iuran akan muncul di sini"
            />
          ) : (
            tagihanList.map((tagihan) => {
              const lastPembayaran = tagihan.pembayaran?.[0];

              return (
                <Card key={tagihan.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Receipt className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{formatPeriode(tagihan.periode)}</p>
                          <p className="text-xs text-muted-foreground">
                            Jatuh tempo: {formatDate(tagihan.jatuh_tempo)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{formatCurrency(tagihan.nominal)}</p>
                        <StatusBadge status={tagihan.status} />
                      </div>
                    </div>
                    {lastPembayaran && (
                      <div className="mt-3 pt-3 border-t flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {lastPembayaran.metode}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Dibayar: {formatDate(lastPembayaran.tanggal_bayar)}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AnggotaLayout>
  );
}
