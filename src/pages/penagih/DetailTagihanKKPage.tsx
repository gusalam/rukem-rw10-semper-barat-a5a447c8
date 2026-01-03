import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { PageTransition } from '@/components/ui/page-transition';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Users,
  Receipt,
  CreditCard,
  Calendar,
  Phone,
  MapPin,
  CheckCircle,
  Clock,
  XCircle,
  Banknote,
} from 'lucide-react';
import type { Anggota, IuranTagihan, IuranPembayaran } from '@/types/database';
import { formatCurrency, formatDate, formatPeriode } from '@/lib/format';

interface TagihanWithPembayaran extends IuranTagihan {
  pembayaran?: IuranPembayaran[];
}

export default function DetailTagihanKKPage() {
  const { noKK } = useParams<{ noKK: string }>();
  const navigate = useNavigate();
  const { penagihWilayah } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kepalaKeluarga, setKepalaKeluarga] = useState<Anggota | null>(null);
  const [anggotaKeluarga, setAnggotaKeluarga] = useState<Anggota[]>([]);
  const [tagihanList, setTagihanList] = useState<TagihanWithPembayaran[]>([]);
  const [stats, setStats] = useState({
    totalTagihan: 0,
    totalLunas: 0,
    totalBelumBayar: 0,
    totalMenunggu: 0,
    nominalLunas: 0,
    nominalBelumBayar: 0,
  });

  useEffect(() => {
    if (noKK && penagihWilayah.length > 0) {
      fetchData();
    }
  }, [noKK, penagihWilayah]);

  const fetchData = async () => {
    if (!noKK) return;

    try {
      // Fetch anggota data
      const { data: anggotaData } = await supabase
        .from('anggota')
        .select('*')
        .eq('no_kk', noKK)
        .eq('status', 'aktif');

      if (anggotaData) {
        const kepala = anggotaData.find(a => a.hubungan_kk === 'Kepala Keluarga') || anggotaData[0];
        setKepalaKeluarga(kepala || null);
        setAnggotaKeluarga(anggotaData);
      }

      // Fetch tagihan
      const { data: tagihanData } = await supabase
        .from('iuran_tagihan')
        .select('*')
        .eq('no_kk', noKK)
        .order('periode', { ascending: false });

      if (tagihanData) {
        // Fetch pembayaran for each tagihan
        const tagihanIds = tagihanData.map(t => t.id);
        const { data: pembayaranData } = await supabase
          .from('iuran_pembayaran')
          .select('*')
          .in('tagihan_id', tagihanIds)
          .order('tanggal_bayar', { ascending: false });

        const tagihanWithPembayaran = tagihanData.map(t => ({
          ...t,
          pembayaran: pembayaranData?.filter(p => p.tagihan_id === t.id) || [],
        }));

        setTagihanList(tagihanWithPembayaran);

        // Calculate stats
        const totalTagihan = tagihanData.length;
        const totalLunas = tagihanData.filter(t => t.status === 'lunas').length;
        const totalBelumBayar = tagihanData.filter(t => t.status === 'belum_bayar').length;
        const totalMenunggu = tagihanData.filter(t => t.status === 'menunggu_admin').length;
        const nominalLunas = tagihanData
          .filter(t => t.status === 'lunas')
          .reduce((sum, t) => sum + t.nominal, 0);
        const nominalBelumBayar = tagihanData
          .filter(t => t.status === 'belum_bayar')
          .reduce((sum, t) => sum + t.nominal, 0);

        setStats({
          totalTagihan,
          totalLunas,
          totalBelumBayar,
          totalMenunggu,
          nominalLunas,
          nominalBelumBayar,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'lunas':
      case 'disetujui':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'menunggu_admin':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'ditolak':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Receipt className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <PenagihLayout>
        <PageTransition>
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-64" />
          </div>
        </PageTransition>
      </PenagihLayout>
    );
  }

  if (!kepalaKeluarga) {
    return (
      <PenagihLayout>
        <PageTransition>
          <EmptyState
            icon={Users}
            title="Data Tidak Ditemukan"
            description="Kartu Keluarga tidak ditemukan atau tidak dalam wilayah tugas Anda"
          >
            <Button onClick={() => navigate('/penagih/riwayat-tagihan')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
          </EmptyState>
        </PageTransition>
      </PenagihLayout>
    );
  }

  return (
    <PenagihLayout>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <PageHeader
              title={kepalaKeluarga.nama_lengkap}
              description={`No. KK: ${noKK}`}
            />
          </div>

          {/* Info Kepala Keluarga */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-primary" />
                Informasi Kepala Keluarga
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Jumlah Anggota</p>
                    <p className="font-medium">{anggotaKeluarga.length} orang</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">No. HP</p>
                    <p className="font-medium">{kepalaKeluarga.no_hp || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:col-span-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Alamat</p>
                    <p className="font-medium">{kepalaKeluarga.alamat}</p>
                    <p className="text-xs text-muted-foreground">
                      RT {kepalaKeluarga.rt}/RW {kepalaKeluarga.rw}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistik */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Receipt className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalTagihan}</p>
                    <p className="text-xs text-muted-foreground">Total Tagihan</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalLunas}</p>
                    <p className="text-xs text-muted-foreground">Lunas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Clock className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalMenunggu}</p>
                    <p className="text-xs text-muted-foreground">Menunggu</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <Banknote className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.totalBelumBayar}</p>
                    <p className="text-xs text-muted-foreground">Belum Bayar</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ringkasan Nominal */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Terbayar</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.nominalLunas)}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tunggakan</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.nominalBelumBayar)}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-500/50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Riwayat Tagihan */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-5 w-5 text-primary" />
                Riwayat Tagihan & Pembayaran
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tagihanList.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="Belum Ada Tagihan"
                  description="Belum ada data tagihan untuk KK ini"
                />
              ) : (
                <div className="space-y-4">
                  {tagihanList.map((tagihan) => (
                    <div
                      key={tagihan.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      {/* Tagihan Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{formatPeriode(tagihan.periode)}</p>
                            <p className="text-xs text-muted-foreground">
                              Jatuh tempo: {formatDate(tagihan.jatuh_tempo)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(tagihan.nominal)}</p>
                          <StatusBadge status={tagihan.status} />
                        </div>
                      </div>

                      {/* Pembayaran List */}
                      {tagihan.pembayaran && tagihan.pembayaran.length > 0 && (
                        <div className="ml-4 pl-4 border-l-2 border-muted space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase">
                            Riwayat Pembayaran
                          </p>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[100px]">Tanggal</TableHead>
                                <TableHead>Nominal</TableHead>
                                <TableHead>Metode</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tagihan.pembayaran.map((pembayaran) => (
                                <TableRow key={pembayaran.id}>
                                  <TableCell className="text-sm">
                                    {formatDate(pembayaran.tanggal_bayar)}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {formatCurrency(pembayaran.nominal)}
                                  </TableCell>
                                  <TableCell>
                                    <span className="capitalize">{pembayaran.metode}</span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {getStatusIcon(pembayaran.status)}
                                      <StatusBadge status={pembayaran.status} />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {tagihan.pembayaran.some(p => p.alasan_tolak) && (
                            <div className="text-xs text-red-500">
                              {tagihan.pembayaran
                                .filter(p => p.alasan_tolak)
                                .map(p => (
                                  <p key={p.id}>Ditolak: {p.alasan_tolak}</p>
                                ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* No Pembayaran */}
                      {(!tagihan.pembayaran || tagihan.pembayaran.length === 0) && 
                       tagihan.status === 'belum_bayar' && (
                        <div className="ml-4 pl-4 border-l-2 border-muted">
                          <p className="text-xs text-muted-foreground italic">
                            Belum ada pembayaran
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Anggota Keluarga */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-primary" />
                Anggota Keluarga ({anggotaKeluarga.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Hubungan</TableHead>
                    <TableHead className="hidden md:table-cell">NIK</TableHead>
                    <TableHead className="hidden md:table-cell">Tanggal Bergabung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anggotaKeluarga.map((anggota) => (
                    <TableRow key={anggota.id}>
                      <TableCell className="font-medium">{anggota.nama_lengkap}</TableCell>
                      <TableCell>{anggota.hubungan_kk || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {anggota.nik}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatDate(anggota.tanggal_bergabung)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    </PenagihLayout>
  );
}
