import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AnggotaLayout } from '@/components/layout/AnggotaLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { HandHeart, Calendar, Wallet, User, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';

interface SantunanWithDetails {
  id: string;
  anggota_id: string;
  kematian_id: string;
  nominal_dasar: number;
  nominal_akhir: number;
  potongan_tunggakan: number | null;
  status: string;
  tanggal_penyaluran: string | null;
  penerima: string | null;
  metode: string | null;
  catatan: string | null;
  created_at: string;
  kematian?: {
    tanggal_meninggal: string;
    tempat_meninggal?: string;
    penyebab?: string;
  } | null;
  anggota?: {
    nama_lengkap: string;
  } | null;
}

export default function AnggotaSantunanPage() {
  const { anggota } = useAuth();
  const [santunanList, setSantunanList] = useState<SantunanWithDetails[]>([]);
  const [pengaturan, setPengaturan] = useState<{ nominal_santunan: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [santunanRes, pengaturanRes] = await Promise.all([
        supabase
          .from('santunan')
          .select(`
            *,
            kematian (
              tanggal_meninggal,
              tempat_meninggal,
              penyebab
            ),
            anggota (
              nama_lengkap
            )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('pengaturan').select('nominal_santunan').limit(1).maybeSingle(),
      ]);

      if (santunanRes.data) {
        setSantunanList(santunanRes.data as SantunanWithDetails[]);
      }
      if (pengaturanRes.data) {
        setPengaturan(pengaturanRes.data);
      }
    } catch (error) {
      console.error('Error fetching santunan:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('santunan-anggota-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'santunan',
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'disalurkan':
        return { label: 'Disalurkan', icon: CheckCircle, color: 'bg-success/10 text-success border-success/20' };
      case 'diproses':
        return { label: 'Diproses', icon: Clock, color: 'bg-info/10 text-info border-info/20' };
      default:
        return { label: 'Pending', icon: AlertCircle, color: 'bg-warning/10 text-warning border-warning/20' };
    }
  };

  const totalDisalurkan = santunanList.filter(s => s.status === 'disalurkan').length;
  const totalNominalDisalurkan = santunanList
    .filter(s => s.status === 'disalurkan')
    .reduce((sum, s) => sum + s.nominal_akhir, 0);

  if (loading) {
    return (
      <AnggotaLayout>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </AnggotaLayout>
    );
  }

  return (
    <AnggotaLayout title="Informasi Santunan">
      <div className="space-y-4">
        {/* Info Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <HandHeart className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Santunan Kematian</h2>
                <p className="text-sm text-muted-foreground">
                  Bantuan duka cita untuk keluarga anggota
                </p>
              </div>
            </div>
            {pengaturan && (
              <div className="mt-4 p-3 rounded-lg bg-background/50">
                <p className="text-sm text-muted-foreground">Nominal Santunan per Kematian</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(pengaturan.nominal_santunan)}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalDisalurkan}</p>
                  <p className="text-xs text-muted-foreground">Sudah Disalurkan</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold">{formatCurrency(totalNominalDisalurkan)}</p>
                  <p className="text-xs text-muted-foreground">Total Disalurkan</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Santunan List */}
        <div className="space-y-3">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <HandHeart className="h-4 w-4" />
            Riwayat Santunan
          </h3>
          
          {santunanList.length === 0 ? (
            <EmptyState
              icon={HandHeart}
              title="Belum ada data santunan"
              description="Data santunan kematian akan tampil di sini"
            />
          ) : (
            santunanList.map((item) => {
              const statusConfig = getStatusConfig(item.status);
              const StatusIcon = statusConfig.icon;

              return (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted shrink-0">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {item.anggota?.nama_lengkap || 'Almarhum/ah'}
                          </p>
                          {item.kematian?.tanggal_meninggal && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3" />
                              <span>Wafat: {formatDate(item.kematian.tanggal_meninggal)}</span>
                            </div>
                          )}
                          {item.kematian?.tempat_meninggal && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              di {item.kematian.tempat_meninggal}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge className={`${statusConfig.color} shrink-0`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>

                    <div className="mt-4 p-3 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Nominal Dasar</span>
                        <span className="font-medium">{formatCurrency(item.nominal_dasar)}</span>
                      </div>
                      {item.potongan_tunggakan && item.potongan_tunggakan > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Potongan Tunggakan</span>
                          <span className="font-medium text-destructive">-{formatCurrency(item.potongan_tunggakan)}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t">
                        <span className="font-medium">Nominal Akhir</span>
                        <span className="font-bold text-primary">{formatCurrency(item.nominal_akhir)}</span>
                      </div>
                    </div>

                    {item.status === 'disalurkan' && (
                      <div className="mt-3 p-2 rounded-lg bg-success/10 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-success" />
                          <span className="text-success font-medium">
                            Disalurkan {item.tanggal_penyaluran ? `pada ${formatDate(item.tanggal_penyaluran)}` : ''}
                          </span>
                        </div>
                        {item.penerima && (
                          <p className="text-muted-foreground ml-6 mt-1">
                            Penerima: {item.penerima}
                          </p>
                        )}
                        {item.metode && (
                          <p className="text-muted-foreground ml-6 capitalize">
                            Metode: {item.metode}
                          </p>
                        )}
                      </div>
                    )}

                    {item.catatan && (
                      <p className="mt-3 text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                        📝 {item.catatan}
                      </p>
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
