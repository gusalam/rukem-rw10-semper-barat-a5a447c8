import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Receipt, CheckCircle, Clock, XCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PenagihRiwayatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  penagihUserId: string;
  penagihNama: string;
}

interface PembayaranRecord {
  id: string;
  nominal: number;
  tanggal_bayar: string;
  metode: string;
  status: string;
  approved_at: string | null;
  catatan: string | null;
  no_kk: string;
  periode: string;
  nama_kepala: string | null;
}

export function PenagihRiwayatDialog({
  open,
  onOpenChange,
  penagihUserId,
  penagihNama,
}: PenagihRiwayatDialogProps) {
  const [loading, setLoading] = useState(true);
  const [pembayaranList, setPembayaranList] = useState<PembayaranRecord[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [stats, setStats] = useState({
    total: 0,
    disetujui: 0,
    menunggu: 0,
    ditolak: 0,
    nominalDisetujui: 0,
  });

  useEffect(() => {
    if (open && penagihUserId) {
      fetchPembayaran();
    }
  }, [open, penagihUserId]);

  const fetchPembayaran = async () => {
    setLoading(true);
    try {
      // Fetch pembayaran by this penagih
      const { data: pembayaranData, error } = await supabase
        .from('iuran_pembayaran')
        .select(`
          id,
          nominal,
          tanggal_bayar,
          metode,
          status,
          approved_at,
          catatan,
          iuran_tagihan(no_kk, periode)
        `)
        .eq('penagih_user_id', penagihUserId)
        .order('tanggal_bayar', { ascending: false });

      if (error) {
        console.error('Error fetching pembayaran:', error);
        setPembayaranList([]);
        return;
      }

      // Get unique no_kk to fetch kepala keluarga names
      const noKKs = [...new Set(pembayaranData?.map(p => (p.iuran_tagihan as any)?.no_kk).filter(Boolean))];
      
      let kepalaMap: Record<string, string> = {};
      if (noKKs.length > 0) {
        const { data: anggotaData } = await supabase
          .from('anggota')
          .select('no_kk, nama_lengkap')
          .in('no_kk', noKKs)
          .eq('status_dalam_kk', 'kepala_keluarga');

        anggotaData?.forEach(a => {
          kepalaMap[a.no_kk] = a.nama_lengkap;
        });
      }

      // Map data
      const mapped: PembayaranRecord[] = (pembayaranData || []).map(p => ({
        id: p.id,
        nominal: p.nominal,
        tanggal_bayar: p.tanggal_bayar,
        metode: p.metode,
        status: p.status,
        approved_at: p.approved_at,
        catatan: p.catatan,
        no_kk: (p.iuran_tagihan as any)?.no_kk || '-',
        periode: (p.iuran_tagihan as any)?.periode || '-',
        nama_kepala: kepalaMap[(p.iuran_tagihan as any)?.no_kk] || null,
      }));

      setPembayaranList(mapped);

      // Calculate stats
      const disetujui = mapped.filter(p => p.status === 'disetujui');
      const menunggu = mapped.filter(p => p.status === 'menunggu_admin');
      const ditolak = mapped.filter(p => p.status === 'ditolak');

      setStats({
        total: mapped.length,
        disetujui: disetujui.length,
        menunggu: menunggu.length,
        ditolak: ditolak.length,
        nominalDisetujui: disetujui.reduce((sum, p) => sum + p.nominal, 0),
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'disetujui':
        return (
          <Badge variant="default" className="bg-success text-success-foreground">
            <CheckCircle className="h-3 w-3 mr-1" />
            Disetujui
          </Badge>
        );
      case 'menunggu_admin':
        return (
          <Badge variant="secondary" className="bg-warning/20 text-warning">
            <Clock className="h-3 w-3 mr-1" />
            Menunggu
          </Badge>
        );
      case 'ditolak':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Ditolak
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredList = filterStatus === 'all' 
    ? pembayaranList 
    : pembayaranList.filter(p => p.status === filterStatus);

  const columns = [
    {
      key: 'tanggal_bayar',
      header: 'Tanggal',
      cell: (item: PembayaranRecord) => (
        <span className="text-sm">
          {format(new Date(item.tanggal_bayar), 'dd MMM yyyy', { locale: localeID })}
        </span>
      ),
    },
    {
      key: 'kepala',
      header: 'Kepala Keluarga',
      cell: (item: PembayaranRecord) => (
        <div>
          <p className="font-medium text-sm">{item.nama_kepala || 'N/A'}</p>
          <p className="text-xs text-muted-foreground">{item.periode}</p>
        </div>
      ),
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: PembayaranRecord) => (
        <span className="font-medium">{formatCurrency(item.nominal)}</span>
      ),
    },
    {
      key: 'metode',
      header: 'Metode',
      cell: (item: PembayaranRecord) => (
        <Badge variant="outline" className="capitalize">
          {item.metode}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: PembayaranRecord) => getStatusBadge(item.status),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Riwayat Pembayaran - {penagihNama}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Transaksi</p>
              </div>
              <div className="bg-success/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-success">{stats.disetujui}</p>
                <p className="text-xs text-muted-foreground">Disetujui</p>
              </div>
              <div className="bg-warning/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-warning">{stats.menunggu}</p>
                <p className="text-xs text-muted-foreground">Menunggu</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-primary">{formatCurrency(stats.nominalDisetujui)}</p>
                <p className="text-xs text-muted-foreground">Total Terkumpul</p>
              </div>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="disetujui">Disetujui</SelectItem>
                  <SelectItem value="menunggu_admin">Menunggu Admin</SelectItem>
                  <SelectItem value="ditolak">Ditolak</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {filteredList.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Belum Ada Riwayat"
                description="Penagih ini belum memiliki riwayat pembayaran."
              />
            ) : (
              <DataTable columns={columns} data={filteredList} />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
