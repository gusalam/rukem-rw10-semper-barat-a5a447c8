import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, Users, MapPin, Phone } from 'lucide-react';
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

  // Group by KK
  const groupedByKK = filteredAnggota.reduce((acc, anggota) => {
    if (!acc[anggota.no_kk]) {
      acc[anggota.no_kk] = [];
    }
    acc[anggota.no_kk].push(anggota);
    return acc;
  }, {} as Record<string, Anggota[]>);

  const uniqueKKCount = Object.keys(groupedByKK).length;

  if (loading) {
    return (
      <PenagihLayout title="Anggota Wilayah">
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
    <PenagihLayout title="Anggota Wilayah">
      <div className="space-y-4">
        {/* Header Card */}
        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-cyan-500/20">
                <Users className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Anggota Wilayah</h2>
                <p className="text-sm text-muted-foreground">{uniqueKKCount} KK • {filteredAnggota.length} anggota</p>
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
        ) : anggotaList.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Tidak Ada Anggota"
            description="Belum ada anggota di wilayah Anda"
          />
        ) : (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama, NIK, atau No. KK..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Anggota List */}
            <div className="space-y-3">
              {filteredAnggota.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Tidak Ditemukan"
                  description="Tidak ada anggota yang cocok dengan pencarian"
                />
              ) : (
                filteredAnggota.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage src={item.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {item.nama_lengkap.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.nama_lengkap}</p>
                          <p className="text-xs text-muted-foreground">KK: {item.no_kk}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {item.hubungan_kk || '-'}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              RT {item.rt || '-'}/RW {item.rw || '-'}
                            </span>
                          </div>
                        </div>
                        {item.no_hp && (
                          <a 
                            href={`tel:${item.no_hp}`}
                            className="p-2 rounded-full bg-primary/10 text-primary shrink-0"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
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
