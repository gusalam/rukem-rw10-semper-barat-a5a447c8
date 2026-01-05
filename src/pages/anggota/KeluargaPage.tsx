import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AnggotaLayout } from '@/components/layout/AnggotaLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Search, 
  User, 
  Calendar, 
  Phone, 
  Briefcase, 
  Heart, 
  MapPin,
  CreditCard 
} from 'lucide-react';
import { formatDate, formatPhoneNumber } from '@/lib/format';
import type { Anggota } from '@/types/database';

export default function AnggotaKeluargaPage() {
  const { anggota } = useAuth();
  const [keluargaList, setKeluargaList] = useState<Anggota[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchKeluarga = useCallback(async () => {
    if (!anggota?.no_kk) return;
    
    try {
      const { data } = await supabase
        .from('anggota')
        .select('*')
        .eq('no_kk', anggota.no_kk)
        .order('status_dalam_kk', { ascending: true });

      // Sort: Kepala Keluarga first, then others
      const sorted = (data || []).sort((a, b) => {
        if (a.status_dalam_kk === 'kepala_keluarga') return -1;
        if (b.status_dalam_kk === 'kepala_keluarga') return 1;
        return a.nama_lengkap.localeCompare(b.nama_lengkap);
      });

      setKeluargaList(sorted as any);
    } catch (error) {
      console.error('Error fetching keluarga:', error);
    } finally {
      setLoading(false);
    }
  }, [anggota?.no_kk]);

  useEffect(() => {
    if (anggota?.no_kk) {
      fetchKeluarga();
    }
  }, [anggota?.no_kk, fetchKeluarga]);

  const filteredKeluarga = useMemo(() => {
    if (!searchQuery.trim()) return keluargaList;
    const query = searchQuery.toLowerCase();
    return keluargaList.filter((member) =>
      member.nama_lengkap.toLowerCase().includes(query) ||
      member.nik.includes(query) ||
      member.status_dalam_kk?.toLowerCase().includes(query) ||
      member.pekerjaan?.toLowerCase().includes(query)
    );
  }, [keluargaList, searchQuery]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aktif':
        return <Badge className="bg-success/10 text-success border-success/20">Aktif</Badge>;
      case 'meninggal':
        return <Badge className="bg-muted text-muted-foreground">Meninggal</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <AnggotaLayout>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </AnggotaLayout>
    );
  }

  return (
    <AnggotaLayout title="Data Keluarga">
      <div className="space-y-4">
        {/* Header Info */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Kartu Keluarga</h2>
                <p className="text-sm text-muted-foreground font-mono">{anggota?.no_kk}</p>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-background/50 flex items-center justify-between">
              <span className="text-muted-foreground">Jumlah Anggota</span>
              <span className="text-2xl font-bold text-primary">{keluargaList.length} orang</span>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        {keluargaList.length > 2 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, NIK, atau hubungan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {/* Member List */}
        <div className="space-y-3">
          {filteredKeluarga.length === 0 ? (
            <EmptyState
              icon={Users}
              title={searchQuery ? 'Tidak ditemukan' : 'Belum ada data'}
              description={searchQuery ? 'Tidak ada hasil untuk pencarian Anda' : 'Data keluarga akan tampil di sini'}
            />
          ) : (
            filteredKeluarga.map((member) => {
              const isCurrentUser = member.id === anggota?.id;
              const age = calculateAge(member.tanggal_lahir);

              return (
                <Card
                  key={member.id}
                  className={isCurrentUser ? 'ring-2 ring-primary/50 bg-primary/5' : ''}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-12 h-12 shrink-0">
                        <AvatarImage src={member.avatar_url || undefined} alt={member.nama_lengkap} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(member.nama_lengkap)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{member.nama_lengkap}</h3>
                          {isCurrentUser && (
                            <Badge className="bg-primary text-primary-foreground text-xs">Anda</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {member.status_dalam_kk && (
                            <Badge variant="outline" className="text-xs">
                              {{
                                'kepala_keluarga': 'Kepala Keluarga',
                                'istri': 'Istri',
                                'anak': 'Anak',
                                'orang_tua': 'Orang Tua',
                                'famili': 'Famili',
                                'lainnya': 'Lainnya',
                              }[member.status_dalam_kk] || member.status_dalam_kk}
                            </Badge>
                          )}
                          {getStatusBadge(member.status)}
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CreditCard className="h-4 w-4 shrink-0" />
                            <span className="font-mono text-xs truncate">{member.nik}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4 shrink-0" />
                            <span>
                              {member.jenis_kelamin === 'L' ? 'Laki-laki' : member.jenis_kelamin === 'P' ? 'Perempuan' : '-'}
                              {age !== null && ` • ${age} tahun`}
                            </span>
                          </div>
                          {member.tanggal_lahir && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-4 w-4 shrink-0" />
                              <span>
                                {member.tempat_lahir && `${member.tempat_lahir}, `}
                                {formatDate(member.tanggal_lahir)}
                              </span>
                            </div>
                          )}
                          {member.pekerjaan && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Briefcase className="h-4 w-4 shrink-0" />
                              <span className="truncate">{member.pekerjaan}</span>
                            </div>
                          )}
                          {member.status_perkawinan && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Heart className="h-4 w-4 shrink-0" />
                              <span>{member.status_perkawinan}</span>
                            </div>
                          )}
                          {member.no_hp && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-4 w-4 shrink-0" />
                              <span>{formatPhoneNumber(member.no_hp)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Footer Note */}
        <p className="text-center text-sm text-muted-foreground py-4">
          Untuk perubahan data, silakan hubungi pengurus RUKEM
        </p>
      </div>
    </AnggotaLayout>
  );
}
