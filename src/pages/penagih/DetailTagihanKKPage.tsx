import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PenagihLayout } from '@/components/layout/PenagihLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Users,
  Receipt,
  Calendar,
  Phone,
  MapPin,
  CheckCircle,
  Clock,
  XCircle,
  Banknote,
  Search,
  Filter,
  X,
} from 'lucide-react';
import type { Anggota, IuranTagihan, IuranPembayaran } from '@/types/database';
import { formatCurrency, formatDate, formatPeriode } from '@/lib/format';

interface TagihanWithPembayaran extends IuranTagihan {
  pembayaran?: IuranPembayaran[];
}

// Generate year options
const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let i = currentYear; i >= currentYear - 5; i--) {
    years.push(i.toString());
  }
  return years;
};

const yearOptions = generateYearOptions();

export default function DetailTagihanKKPage() {
  const { noKK } = useParams<{ noKK: string }>();
  const navigate = useNavigate();
  const { penagihWilayah } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kepalaKeluarga, setKepalaKeluarga] = useState<Anggota | null>(null);
  const [anggotaKeluarga, setAnggotaKeluarga] = useState<Anggota[]>([]);
  const [tagihanList, setTagihanList] = useState<TagihanWithPembayaran[]>([]);
  
  // Filter states
  const [searchPeriode, setSearchPeriode] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');

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
        const kepala = anggotaData.find(a => a.status_dalam_kk === 'kepala_keluarga') || anggotaData[0];
        setKepalaKeluarga(kepala as any || null);
        setAnggotaKeluarga(anggotaData as any);
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
      <PenagihLayout title="Detail KK">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PenagihLayout>
    );
  }

  if (!kepalaKeluarga) {
    return (
      <PenagihLayout title="Detail KK">
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
      </PenagihLayout>
    );
  }

  return (
    <PenagihLayout title="Detail KK">
      <div className="space-y-4">
        {/* Header Card */}
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="shrink-0 -ml-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold truncate">{kepalaKeluarga.nama_lengkap}</h2>
                <p className="text-sm text-muted-foreground">KK: {noKK}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {anggotaKeluarga.length} anggota
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <MapPin className="h-3 w-3 mr-1" />
                    RT {kepalaKeluarga.rt}/RW {kepalaKeluarga.rw}
                  </Badge>
                </div>
              </div>
            </div>
            {kepalaKeluarga.no_hp && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                <a href={`tel:${kepalaKeluarga.no_hp}`} className="hover:underline">{kepalaKeluarga.no_hp}</a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-lg font-bold">{stats.totalTagihan}</p>
                  <p className="text-[10px] text-muted-foreground">Total Tagihan</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-success/20 bg-success/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <div>
                  <p className="text-lg font-bold">{stats.totalLunas}</p>
                  <p className="text-[10px] text-muted-foreground">Lunas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-warning/20 bg-warning/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-lg font-bold">{stats.totalMenunggu}</p>
                  <p className="text-[10px] text-muted-foreground">Menunggu</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-lg font-bold">{stats.totalBelumBayar}</p>
                  <p className="text-[10px] text-muted-foreground">Belum Bayar</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ringkasan Nominal */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-success/20 bg-success/5">
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-6 w-6 text-success mx-auto" />
              <p className="text-sm font-bold text-success mt-1">{formatCurrency(stats.nominalLunas)}</p>
              <p className="text-[10px] text-muted-foreground">Terbayar</p>
            </CardContent>
          </Card>
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-4 text-center">
              <XCircle className="h-6 w-6 text-destructive mx-auto" />
              <p className="text-sm font-bold text-destructive mt-1">{formatCurrency(stats.nominalBelumBayar)}</p>
              <p className="text-[10px] text-muted-foreground">Tunggakan</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter & Search */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari periode..."
              value={searchPeriode}
              onChange={(e) => setSearchPeriode(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="pl-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
                  <SelectItem value="menunggu_admin">Menunggu</SelectItem>
                  <SelectItem value="lunas">Lunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="pl-9">
                  <SelectValue placeholder="Tahun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tahun</SelectItem>
                  {yearOptions.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(searchPeriode || filterStatus !== 'all' || filterYear !== 'all') && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSearchPeriode('');
                  setFilterStatus('all');
                  setFilterYear('all');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Tagihan List */}
        <FilteredTagihanList
          tagihanList={tagihanList}
          searchPeriode={searchPeriode}
          filterStatus={filterStatus}
          filterYear={filterYear}
          getStatusIcon={getStatusIcon}
        />

        {/* Anggota Keluarga */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Anggota Keluarga ({anggotaKeluarga.length})</h3>
            </div>
            <div className="space-y-3">
              {anggotaKeluarga.map((anggota) => (
                <div key={anggota.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{anggota.nama_lengkap}</p>
                    <p className="text-xs text-muted-foreground">{anggota.hubungan_kk || '-'}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{anggota.nik}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PenagihLayout>
  );
}

// FilteredTagihanList component
interface FilteredTagihanListProps {
  tagihanList: TagihanWithPembayaran[];
  searchPeriode: string;
  filterStatus: string;
  filterYear: string;
  getStatusIcon: (status: string) => React.ReactNode;
}

function FilteredTagihanList({
  tagihanList,
  searchPeriode,
  filterStatus,
  filterYear,
  getStatusIcon,
}: FilteredTagihanListProps) {
  const filteredTagihan = useMemo(() => {
    return tagihanList.filter(tagihan => {
      // Search by periode
      const matchesSearch = !searchPeriode || 
        formatPeriode(tagihan.periode).toLowerCase().includes(searchPeriode.toLowerCase()) ||
        tagihan.periode.includes(searchPeriode);
      
      // Filter by status
      const matchesStatus = filterStatus === 'all' || tagihan.status === filterStatus;
      
      // Filter by year
      const matchesYear = filterYear === 'all' || tagihan.periode.startsWith(filterYear);
      
      return matchesSearch && matchesStatus && matchesYear;
    });
  }, [tagihanList, searchPeriode, filterStatus, filterYear]);

  if (tagihanList.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Belum Ada Tagihan"
        description="Belum ada data tagihan untuk KK ini"
      />
    );
  }

  if (filteredTagihan.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Tidak Ada Hasil"
        description="Tidak ada tagihan yang sesuai dengan filter"
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Menampilkan {filteredTagihan.length} dari {tagihanList.length} tagihan
      </p>
      {filteredTagihan.map((tagihan) => (
        <Card key={tagihan.id}>
          <CardContent className="p-4">
            {/* Tagihan Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted shrink-0">
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
                <p className="font-bold text-primary">{formatCurrency(tagihan.nominal)}</p>
                <StatusBadge status={tagihan.status} />
              </div>
            </div>

            {/* Pembayaran List */}
            {tagihan.pembayaran && tagihan.pembayaran.length > 0 && (
              <div className="mt-3 pt-3 border-t space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Riwayat Pembayaran</p>
                {tagihan.pembayaran.map((pembayaran) => (
                  <div key={pembayaran.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium">{formatCurrency(pembayaran.nominal)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(pembayaran.tanggal_bayar)} • {pembayaran.metode}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(pembayaran.status)}
                      <StatusBadge status={pembayaran.status} />
                    </div>
                  </div>
                ))}
                {tagihan.pembayaran.some(p => p.alasan_tolak) && (
                  <div className="text-xs text-destructive p-2 bg-destructive/10 rounded">
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
              <p className="mt-3 pt-3 border-t text-xs text-muted-foreground italic">
                Belum ada pembayaran
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
