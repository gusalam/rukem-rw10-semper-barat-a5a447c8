import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Search } from 'lucide-react';
import { formatCurrency, formatDate, formatPeriode } from '@/lib/format';
import type { IuranTagihan, Anggota } from '@/types/database';

interface TagihanWithKK extends IuranTagihan {
  kepala_keluarga?: Anggota;
}

export default function RiwayatTagihanPage() {
  const { user, penagihWilayah } = useAuth();
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
      
      // Get anggota in penagih wilayah
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

      // Fetch tagihan
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

  // Realtime subscription
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'belum_bayar': return 'Belum Bayar';
      case 'menunggu_admin': return 'Menunggu Verifikasi';
      case 'lunas': return 'Lunas';
      default: return status;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'belum_bayar': return 'destructive';
      case 'menunggu_admin': return 'warning';
      case 'lunas': return 'success';
      default: return 'secondary';
    }
  };

  const filteredTagihan = tagihanList.filter(t => 
    t.kepala_keluarga?.nama_lengkap?.toLowerCase().includes(search.toLowerCase()) ||
    t.no_kk?.toLowerCase().includes(search.toLowerCase()) ||
    t.periode?.includes(search)
  );

  const columns = [
    {
      key: 'nama_kk',
      header: 'Nama KK',
      cell: (item: TagihanWithKK) => (
        <div>
          <p className="font-medium text-sm">{item.kepala_keluarga?.nama_lengkap || '-'}</p>
          <p className="text-xs text-muted-foreground">KK: {item.no_kk}</p>
        </div>
      ),
    },
    {
      key: 'periode',
      header: 'Periode',
      cell: (item: TagihanWithKK) => formatPeriode(item.periode),
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: TagihanWithKK) => (
        <span className="font-medium">{formatCurrency(item.nominal)}</span>
      ),
      className: 'hidden sm:table-cell',
    },
    {
      key: 'jatuh_tempo',
      header: 'Jatuh Tempo',
      cell: (item: TagihanWithKK) => formatDate(item.jatuh_tempo),
      className: 'hidden md:table-cell',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: TagihanWithKK) => (
        <StatusBadge 
          status={getStatusLabel(item.status)} 
          variant={getStatusVariant(item.status) as any} 
        />
      ),
    },
  ];

  if (loading) {
    return (
      <PenagihLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64" />
        </div>
      </PenagihLayout>
    );
  }

  return (
    <PenagihLayout>
      <PageHeader 
        title="Riwayat Tagihan" 
        description="Daftar tagihan di wilayah Anda"
      />

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama KK, No. KK, atau periode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {filteredTagihan.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Tidak Ada Tagihan"
            description={search ? 'Tidak ada tagihan yang sesuai pencarian.' : 'Belum ada tagihan di wilayah Anda.'}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Daftar Tagihan ({filteredTagihan.length} data)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable columns={columns} data={filteredTagihan} />
            </CardContent>
          </Card>
        )}
      </div>
    </PenagihLayout>
  );
}
