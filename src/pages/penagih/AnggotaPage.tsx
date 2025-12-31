import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Users, MapPin } from 'lucide-react';
import type { Anggota } from '@/types/database';

export default function PenagihAnggotaPage() {
  const { penagihWilayah } = useAuth();
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (penagihWilayah.length > 0) {
      fetchAnggota();
    } else {
      setLoading(false);
    }
  }, [penagihWilayah]);

  const fetchAnggota = async () => {
    try {
      const { data } = await supabase
        .from('anggota')
        .select('*')
        .eq('status', 'aktif')
        .order('nama_lengkap');

      if (data) {
        // Filter by penagih wilayah
        const rtRwPairs = penagihWilayah.map(w => ({ rt: w.rt, rw: w.rw }));
        const filtered = data.filter(a => 
          rtRwPairs.some(pair => pair.rt === a.rt && pair.rw === a.rw)
        );
        setAnggotaList(filtered as Anggota[]);
      }
    } catch (error) {
      console.error('Error fetching anggota:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAnggota = anggotaList.filter(a => 
    a.nama_lengkap.toLowerCase().includes(search.toLowerCase()) ||
    a.no_kk.includes(search) ||
    a.nik.includes(search)
  );

  const columns = [
    {
      key: 'nama',
      header: 'Nama',
      cell: (item: Anggota) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={item.avatar_url || undefined} />
            <AvatarFallback>{item.nama_lengkap.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{item.nama_lengkap}</p>
            <p className="text-xs text-muted-foreground">{item.hubungan_kk || '-'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'no_kk',
      header: 'No. KK',
      cell: (item: Anggota) => item.no_kk,
    },
    {
      key: 'alamat',
      header: 'RT/RW',
      cell: (item: Anggota) => `RT ${item.rt || '-'} / RW ${item.rw || '-'}`,
    },
    {
      key: 'no_hp',
      header: 'No. HP',
      cell: (item: Anggota) => item.no_hp,
      className: 'hidden md:table-cell',
    },
  ];

  if (loading) {
    return (
      <PenagihLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
        </div>
      </PenagihLayout>
    );
  }

  return (
    <PenagihLayout>
      <PageHeader 
        title="Anggota Wilayah" 
        description="Daftar anggota di wilayah Anda"
      />

      {penagihWilayah.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Belum Ada Wilayah"
          description="Anda belum ditugaskan ke wilayah manapun"
        />
      ) : anggotaList.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Tidak Ada Anggota"
          description="Belum ada anggota di wilayah Anda"
        />
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama, NIK, atau No. KK..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <DataTable
            columns={columns}
            data={filteredAnggota}
            emptyMessage="Tidak ada anggota yang cocok dengan pencarian"
          />
        </>
      )}
    </PenagihLayout>
  );
}
