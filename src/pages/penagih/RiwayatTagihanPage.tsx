import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Search, Eye, Receipt, MapPin } from 'lucide-react';
import { formatCurrency, formatPeriode } from '@/lib/format';
import type { IuranTagihan, Anggota } from '@/types/database';

interface TagihanWithKK extends IuranTagihan {
  kepala_keluarga?: Anggota;
}

export default function RiwayatTagihanPage() {
  const { user, penagihWilayah } = useAuth();
  const navigate = useNavigate();
  const [tagihanList, setTagihanList] = useState<TagihanWithKK[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user || penagihWilayah.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const rtRwPairs = penagihWilayah.map(w => ({ rt: w.rt, rw: w.rw }));
      
      const { data: anggotaData } = await supabase
        .from('anggota')
        .select('id, no_kk, rt, rw, nama_lengkap, hubungan_kk')
        .eq('status', 'aktif');
      
      const filteredAnggota = anggotaData?.filter(a => 
        rtRwPairs.some(pair => pair.rt === a.rt && pair.rw === a.rw)
      ) || [];

      const uniqueKKs = [...new Set(filteredAnggota.map(a => a.no_kk))];

      if (uniqueKKs.length === 0) {
        setTagihanList([]);
        setLoading(false);
        return;
      }

      const { data: tagihanData } = await supabase
        .from('iuran_tagihan')
        .select('*')
        .in('no_kk', uniqueKKs)
        .order('jatuh_tempo', { ascending: false });

      const processedData: TagihanWithKK[] = (tagihanData || []).map(t => {
        const kepala = filteredAnggota.find(a => a.no_kk === t.no_kk && a.hubungan_kk === 'Kepala Keluarga')
          || filteredAnggota.find(a => a.no_kk === t.no_kk);
        return { ...t, kepala_keluarga: kepala as Anggota };
      });

      setTagihanList(processedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, penagihWilayah]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('penagih-tagihan-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iuran_tagihan' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchData]);

  const filteredTagihan = tagihanList.filter(t => 
    t.kepala_keluarga?.nama_lengkap?.toLowerCase().includes(search.toLowerCase()) ||
    t.no_kk?.toLowerCase().includes(search.toLowerCase()) ||
    t.periode?.includes(search)
  );

  if (loading) {
    return (
      <PenagihLayout title="Riwayat Tagihan">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </PenagihLayout>
    );
  }

  return (
    <PenagihLayout title="Riwayat Tagihan">
      <div className="space-y-4">
        {/* Header Card */}
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-500/20">
                <Receipt className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Riwayat Tagihan</h2>
                <p className="text-sm text-muted-foreground">{filteredTagihan.length} tagihan di wilayah Anda</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {penagihWilayah.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Belum Ada Wilayah"
            description="Anda belum ditugaskan ke wilayah manapun"
          />
        ) : (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama KK, No. KK, atau periode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Tagihan List */}
            <div className="space-y-3">
              {filteredTagihan.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Tidak Ada Tagihan"
                  description={search ? 'Tidak ada tagihan yang sesuai pencarian.' : 'Belum ada tagihan di wilayah Anda.'}
                />
              ) : (
                filteredTagihan.map((item) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                            <Receipt className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{item.kepala_keluarga?.nama_lengkap || '-'}</p>
                            <p className="text-xs text-muted-foreground">KK: {item.no_kk}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-sm font-medium text-primary">
                                {formatPeriode(item.periode)}
                              </span>
                              <StatusBadge status={item.status} />
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="font-bold text-primary">{formatCurrency(item.nominal)}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1"
                            onClick={() => navigate(`/penagih/tagihan/${encodeURIComponent(item.no_kk)}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Detail
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </PenagihLayout>
  );
}
