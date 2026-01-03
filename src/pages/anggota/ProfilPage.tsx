import { useAuth } from '@/contexts/AuthContext';
import { AnggotaLayout } from '@/components/layout/AnggotaLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  CreditCard, 
  Briefcase, 
  Heart, 
  Users,
  Mail 
} from 'lucide-react';
import { formatDate, formatPhoneNumber } from '@/lib/format';

export default function AnggotaProfilPage() {
  const { anggota, user, loading } = useAuth();

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

  const formatAlamatLengkap = () => {
    if (!anggota) return '-';
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

  if (loading) {
    return (
      <AnggotaLayout>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
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

  const age = calculateAge(anggota.tanggal_lahir);

  return (
    <AnggotaLayout title="Profil Saya">
      <div className="space-y-4">
        {/* Profile Header */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={anggota.avatar_url || undefined} alt={anggota.nama_lengkap} />
                <AvatarFallback className="bg-primary/20 text-primary text-lg">
                  {getInitials(anggota.nama_lengkap)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-bold">{anggota.nama_lengkap}</h2>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge className="bg-success/10 text-success border-success/20">
                    {anggota.status === 'aktif' ? 'Anggota Aktif' : anggota.status}
                  </Badge>
                  {anggota.hubungan_kk && (
                    <Badge variant="outline">{anggota.hubungan_kk}</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Identitas */}
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Data Identitas
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">NIK</p>
                  <p className="font-mono">{anggota.nik}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">No. Kartu Keluarga</p>
                  <p className="font-mono">{anggota.no_kk}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Pribadi */}
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
              <User className="h-4 w-4" />
              Data Pribadi
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <User className="h-3 w-3" />
                  <span className="text-xs">Jenis Kelamin</span>
                </div>
                <p className="text-sm font-medium">
                  {anggota.jenis_kelamin === 'L' ? 'Laki-laki' : anggota.jenis_kelamin === 'P' ? 'Perempuan' : '-'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-3 w-3" />
                  <span className="text-xs">Usia</span>
                </div>
                <p className="text-sm font-medium">{age !== null ? `${age} tahun` : '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 col-span-2">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-3 w-3" />
                  <span className="text-xs">Tempat, Tanggal Lahir</span>
                </div>
                <p className="text-sm font-medium">
                  {anggota.tempat_lahir || '-'}
                  {anggota.tanggal_lahir && `, ${formatDate(anggota.tanggal_lahir)}`}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-3 w-3" />
                  <span className="text-xs">Agama</span>
                </div>
                <p className="text-sm font-medium">{anggota.agama || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Heart className="h-3 w-3" />
                  <span className="text-xs">Status</span>
                </div>
                <p className="text-sm font-medium">{anggota.status_perkawinan || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 col-span-2">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Briefcase className="h-3 w-3" />
                  <span className="text-xs">Pekerjaan</span>
                </div>
                <p className="text-sm font-medium">{anggota.pekerjaan || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alamat */}
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Alamat
            </h3>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm">{formatAlamatLengkap()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Kontak */}
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Kontak
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">No. HP</p>
                  <p className="text-sm font-medium">{formatPhoneNumber(anggota.no_hp)}</p>
                </div>
              </div>
              {user?.email && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email Akun</p>
                    <p className="text-sm font-medium">{user.email}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Keanggotaan */}
        <Card>
          <CardContent className="pt-4">
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Keanggotaan
            </h3>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Bergabung Sejak</p>
              <p className="text-sm font-medium">{formatDate(anggota.tanggal_bergabung)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <p className="text-center text-sm text-muted-foreground py-4">
          Untuk mengubah data, silakan hubungi pengurus RUKEM
        </p>
      </div>
    </AnggotaLayout>
  );
}
