import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AnggotaLayout } from '@/components/layout/AnggotaLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { ListItemSkeleton } from '@/components/ui/loading-skeleton';
import { History, Receipt, User } from 'lucide-react';
import type { IuranPembayaran } from '@/types/database';
import { formatCurrency, formatPeriode, formatDateTime } from '@/lib/format';

interface RiwayatPembayaran {
  id: string;
  tagihan_id: string;
  penagih_user_id: string;
  nominal: number;
  metode: string;
  status: string;
  tanggal_bayar: string;
  catatan: string | null;
  alasan_tolak: string | null;
  approved_at: string | null;
  tagihan?: {
    periode: string;
    nominal: number;
    no_kk: string;
  };
  penagih_profile?: {
    full_name: string | null;
  };
}

export default function AnggotaRiwayatPage() {
  const { anggota } = useAuth();
  const [riwayatList, setRiwayatList] = useState<RiwayatPembayaran[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRiwayat = useCallback(async () => {
    if (!anggota) return;
    
    try {
      // Get all tagihan for this KK first
      const { data: tagihanData } = await supabase
        .from('iuran_tagihan')
        .select('id')
        .eq('no_kk', anggota.no_kk);

      if (!tagihanData || tagihanData.length === 0) {
        setRiwayatList([]);
        setLoading(false);
        return;
      }

      const tagihanIds = tagihanData.map(t => t.id);

      // Get all pembayaran for these tagihan
      const { data: pembayaranData, error } = await supabase
        .from('iuran_pembayaran')
        .select(`
          *,
          iuran_tagihan!tagihan_id (
            periode,
            nominal,
            no_kk
          )
        `)
        .in('tagihan_id', tagihanIds)
        .order('tanggal_bayar', { ascending: false });

      if (error) throw error;

      // Get penagih profiles
      const penagihIds = [...new Set(pembayaranData?.map(p => p.penagih_user_id).filter(Boolean))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', penagihIds);

      // Map data together
      const riwayatWithDetails = (pembayaranData || []).map(p => ({
        ...p,
        tagihan: p.iuran_tagihan as any,
        penagih_profile: profilesData?.find(pr => pr.user_id === p.penagih_user_id),
      }));

      setRiwayatList(riwayatWithDetails as RiwayatPembayaran[]);
    } catch (error) {
      console.error('Error fetching riwayat:', error);
    } finally {
      setLoading(false);
    }
  }, [anggota]);

  useEffect(() => {
    if (anggota) {
      fetchRiwayat();
    }
  }, [anggota, fetchRiwayat]);

  // Real-time subscription
  useEffect(() => {
    if (!anggota) return;

    const channel = supabase
      .channel('pembayaran-riwayat-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'iuran_pembayaran',
        },
        () => fetchRiwayat()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [anggota, fetchRiwayat]);

  if (loading) {
    return (
      <AnggotaLayout>
        <PageHeader title="Riwayat Pembayaran" description="Memuat riwayat..." />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <ListItemSkeleton />
              </CardContent>
            </Card>
          ))}
        </div>
      </AnggotaLayout>
    );
  }

  return (
    <AnggotaLayout>
      <PageHeader 
        title="Riwayat Pembayaran" 
        description="Riwayat pembayaran iuran yang dilakukan oleh penagih" 
      />

      <div className="mt-6 space-y-3">
        {riwayatList.length === 0 ? (
          <EmptyState
            icon={History}
            title="Belum ada riwayat"
            description="Riwayat pembayaran Anda akan muncul di sini setelah penagih menginput pembayaran"
          />
        ) : (
          riwayatList.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                      <Receipt className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {item.tagihan ? formatPeriode(item.tagihan.periode) : 'Iuran'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(item.tanggal_bayar)}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="outline" className="text-xs capitalize">
                          {item.metode}
                        </Badge>
                        {item.penagih_profile?.full_name && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{item.penagih_profile.full_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{formatCurrency(item.nominal)}</p>
                    <div className="mt-1">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                </div>

                {/* Additional details */}
                {item.catatan && (
                  <div className="mt-3 p-2 bg-muted/50 rounded text-sm">
                    <span className="text-muted-foreground">Catatan:</span> {item.catatan}
                  </div>
                )}

                {item.alasan_tolak && (
                  <div className="mt-3 p-2 bg-destructive/10 rounded text-sm text-destructive">
                    <span className="font-medium">Alasan ditolak:</span> {item.alasan_tolak}
                  </div>
                )}

                {item.status === 'disetujui' && item.approved_at && (
                  <div className="mt-3 p-2 bg-success/10 rounded text-sm text-success">
                    ✓ Diverifikasi pada {formatDateTime(item.approved_at)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AnggotaLayout>
  );
}
