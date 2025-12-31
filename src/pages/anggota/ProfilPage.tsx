import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AnggotaLayout } from '@/components/layout/AnggotaLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProfileSkeleton } from '@/components/ui/loading-skeleton';
import { Input } from '@/components/ui/input';
import { User, Phone, MapPin, Calendar, CreditCard, Briefcase, Heart, Users, Home, Search } from 'lucide-react';
import { formatDate, formatPhoneNumber } from '@/lib/format';
import type { Anggota } from '@/types/database';

export default function AnggotaProfilPage() {
  const { anggota, user, loading } = useAuth();
  const [keluargaList, setKeluargaList] = useState<Anggota[]>([]);
  const [loadingKeluarga, setLoadingKeluarga] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredKeluarga = useMemo(() => {
    if (!searchQuery.trim()) return keluargaList;
    const query = searchQuery.toLowerCase();
    return keluargaList.filter((member) =>
      member.nama_lengkap.toLowerCase().includes(query) ||
      member.nik.includes(query) ||
      member.hubungan_kk?.toLowerCase().includes(query) ||
      member.pekerjaan?.toLowerCase().includes(query)
    );
  }, [keluargaList, searchQuery]);

  useEffect(() => {
    if (anggota?.no_kk) {
      fetchKeluarga();
    }
  }, [anggota?.no_kk]);

  const fetchKeluarga = async () => {
    if (!anggota?.no_kk) return;
    setLoadingKeluarga(true);
    try {
      const { data } = await supabase
        .from('anggota')
        .select('*')
        .eq('no_kk', anggota.no_kk)
        .order('hubungan_kk', { ascending: true });
      
      // Sort: Kepala Keluarga first, then others
      const sorted = (data || []).sort((a, b) => {
        if (a.hubungan_kk === 'Kepala Keluarga') return -1;
        if (b.hubungan_kk === 'Kepala Keluarga') return 1;
        return a.nama_lengkap.localeCompare(b.nama_lengkap);
      });
      
      setKeluargaList(sorted);
    } catch (error) {
      console.error('Error fetching keluarga:', error);
    } finally {
      setLoadingKeluarga(false);
    }
  };

  if (loading) {
    return (
      <AnggotaLayout>
        <PageHeader title="Profil Saya" description="Memuat data profil..." />
        <div className="mt-6">
          <ProfileSkeleton />
        </div>
      </AnggotaLayout>
    );
  }

  if (!anggota) {
    return (
      <AnggotaLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Data profil tidak ditemukan</p>
        </div>
      </AnggotaLayout>
    );
  }

  const formatAlamatLengkap = () => {
    const parts = [
      anggota.alamat,
      anggota.rt && anggota.rw ? `RT ${anggota.rt}/RW ${anggota.rw}` : null,
      anggota.kelurahan ? `Kel. ${anggota.kelurahan}` : null,
      anggota.kecamatan ? `Kec. ${anggota.kecamatan}` : null,
      anggota.kabupaten_kota,
      anggota.provinsi,
    ].filter(Boolean);
    return parts.join(', ');
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <AnggotaLayout>
      <PageHeader title="Profil Saya" description="Informasi data keanggotaan Anda" />

      <div className="mt-6 space-y-4">
        {/* Profile Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={anggota.avatar_url || undefined} alt={anggota.nama_lengkap} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {getInitials(anggota.nama_lengkap)}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-xl">{anggota.nama_lengkap}</CardTitle>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    {anggota.status === 'aktif' ? 'Anggota Aktif' : anggota.status}
                  </Badge>
                  {anggota.hubungan_kk && (
                    <Badge variant="secondary">{anggota.hubungan_kk}</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Family Members Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="h-4 w-4" />
                Anggota Keluarga (KK: {anggota.no_kk})
              </CardTitle>
              <Badge variant="outline">{keluargaList.length} orang</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {keluargaList.length > 1 && (
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
            {loadingKeluarga ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : filteredKeluarga.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {searchQuery ? 'Tidak ada hasil pencarian' : 'Tidak ada data anggota keluarga'}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredKeluarga.map((member) => {
                  const isCurrentUser = member.id === anggota.id;
                  const age = calculateAge(member.tanggal_lahir);
                  
                  return (
                    <div 
                      key={member.id} 
                      className={`p-4 rounded-lg border ${isCurrentUser ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10 shrink-0">
                          <AvatarImage src={member.avatar_url || undefined} alt={member.nama_lengkap} />
                          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                            {getInitials(member.nama_lengkap)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{member.nama_lengkap}</p>
                            {isCurrentUser && (
                              <Badge variant="default" className="text-xs">Anda</Badge>
                            )}
                            {member.hubungan_kk && (
                              <Badge variant="secondary" className="text-xs">{member.hubungan_kk}</Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3" />
                              <span className="font-mono text-xs">{member.nik}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>
                                {member.jenis_kelamin === 'L' ? 'Laki-laki' : member.jenis_kelamin === 'P' ? 'Perempuan' : '-'}
                                {age !== null && ` (${age} tahun)`}
                              </span>
                            </div>
                            {member.tempat_lahir && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span>{member.tempat_lahir}</span>
                              </div>
                            )}
                            {member.tanggal_lahir && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDate(member.tanggal_lahir)}</span>
                              </div>
                            )}
                            {member.pekerjaan && (
                              <div className="flex items-center gap-1">
                                <Briefcase className="h-3 w-3" />
                                <span>{member.pekerjaan}</span>
                              </div>
                            )}
                            {member.agama && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>{member.agama}</span>
                              </div>
                            )}
                            {member.status_perkawinan && (
                              <div className="flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                <span>{member.status_perkawinan}</span>
                              </div>
                            )}
                            {member.no_hp && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                <span>{formatPhoneNumber(member.no_hp)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Pribadi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">NIK</p>
                  <p className="font-mono">{anggota.nik}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">No. Kartu Keluarga</p>
                  <p className="font-mono">{anggota.no_kk}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Jenis Kelamin</p>
                  <p>{anggota.jenis_kelamin === 'L' ? 'Laki-laki' : anggota.jenis_kelamin === 'P' ? 'Perempuan' : '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Tempat, Tanggal Lahir</p>
                  <p>
                    {anggota.tempat_lahir || '-'}
                    {anggota.tanggal_lahir && `, ${formatDate(anggota.tanggal_lahir)}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Agama</p>
                  <p>{anggota.agama || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Heart className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Status Perkawinan</p>
                  <p>{anggota.status_perkawinan || '-'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Pekerjaan</p>
                <p>{anggota.pekerjaan || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alamat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p>{formatAlamatLengkap()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kontak</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">No. HP</p>
                <p>{formatPhoneNumber(anggota.no_hp)}</p>
              </div>
            </div>
            {user?.email && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Email Akun</p>
                  <p>{user.email}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Membership Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Keanggotaan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Tanggal Bergabung</p>
                <p>{formatDate(anggota.tanggal_bergabung)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground py-4">
          Untuk mengubah data, silakan hubungi pengurus RUKEM
        </p>
      </div>
    </AnggotaLayout>
  );
}