import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/hooks/use-toast';
import { StandardMessages, getErrorMessage } from '@/lib/error-messages';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { HandHeart, Eye, CheckCircle } from 'lucide-react';
import type { Santunan, StatusSantunan, MetodePembayaran } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/format';

export default function SantunanPage() {
  const [santunanList, setSantunanList] = useState<Santunan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSantunan, setSelectedSantunan] = useState<Santunan | null>(null);
  const [formData, setFormData] = useState({
    tanggal_penyaluran: new Date().toISOString().split('T')[0],
    metode: 'transfer' as MetodePembayaran,
    penerima: '',
    catatan: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSantunan();
  }, []);

  const fetchSantunan = async () => {
    try {
      const { data, error } = await supabase
        .from('santunan')
        .select('*, anggota(*), kematian(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSantunanList(data as Santunan[]);
    } catch (error) {
      console.error('Error fetching santunan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!selectedSantunan) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check kas balance
      const { data: kasData } = await supabase.from('kas').select('jenis, nominal');
      const saldo = kasData?.reduce((acc, k) => acc + (k.jenis === 'pemasukan' ? k.nominal : -k.nominal), 0) || 0;

      if (saldo < selectedSantunan.nominal_akhir) {
        toast({
          variant: 'destructive',
          title: '⚠️ Saldo Tidak Cukup',
          description: `Saldo kas: ${formatCurrency(saldo)}. Dibutuhkan: ${formatCurrency(selectedSantunan.nominal_akhir)}`,
        });
        setSubmitting(false);
        return;
      }

      // Update santunan - kas will be created automatically by trigger
      await supabase
        .from('santunan')
        .update({
          status: 'disalurkan' as StatusSantunan,
          tanggal_penyaluran: formData.tanggal_penyaluran,
          metode: formData.metode,
          penerima: formData.penerima,
          catatan: formData.catatan,
          processed_by: user?.id,
        })
        .eq('id', selectedSantunan.id);

      toast({ 
        title: '✓ Santunan Disalurkan', 
        description: StandardMessages.success.santunan.distribute 
      });
      setDialogOpen(false);
      fetchSantunan();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: '✕ Gagal',
        description: getErrorMessage(error, StandardMessages.error.save),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openProcessDialog = (santunan: Santunan) => {
    setSelectedSantunan(santunan);
    setFormData({
      tanggal_penyaluran: new Date().toISOString().split('T')[0],
      metode: 'transfer',
      penerima: '',
      catatan: '',
    });
    setDialogOpen(true);
  };

  const columns = [
    {
      key: 'anggota',
      header: 'Nama Almarhum',
      cell: (item: Santunan) => item.anggota?.nama_lengkap || '-',
    },
    {
      key: 'nominal_akhir',
      header: 'Nominal',
      cell: (item: Santunan) => formatCurrency(item.nominal_akhir),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: Santunan) => <StatusBadge status={item.status} />,
    },
    {
      key: 'tanggal_penyaluran',
      header: 'Tgl Penyaluran',
      cell: (item: Santunan) => item.tanggal_penyaluran ? formatDate(item.tanggal_penyaluran) : '-',
      className: 'hidden md:table-cell',
    },
    {
      key: 'actions',
      header: '',
      cell: (item: Santunan) => (
        item.status !== 'disalurkan' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openProcessDialog(item)}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Proses
          </Button>
        ) : (
          <Button variant="ghost" size="sm" disabled>
            <Eye className="h-4 w-4" />
          </Button>
        )
      ),
    },
  ];

  return (
    <AdminLayout>
      <PageHeader title="Penyaluran Santunan" description="Kelola penyaluran santunan kepada keluarga" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proses Penyaluran Santunan</DialogTitle>
          </DialogHeader>
          {selectedSantunan && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Almarhum</span>
                  <span className="font-medium">{selectedSantunan.anggota?.nama_lengkap}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nominal Dasar</span>
                  <span>{formatCurrency(selectedSantunan.nominal_dasar)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Potongan</span>
                  <span className="text-destructive">-{formatCurrency(selectedSantunan.potongan_tunggakan)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-bold">
                  <span>Nominal Akhir</span>
                  <span className="text-primary">{formatCurrency(selectedSantunan.nominal_akhir)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tanggal Penyaluran</Label>
                <Input
                  type="date"
                  value={formData.tanggal_penyaluran}
                  onChange={(e) => setFormData({ ...formData, tanggal_penyaluran: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Metode</Label>
                <Select
                  value={formData.metode}
                  onValueChange={(value: MetodePembayaran) => setFormData({ ...formData, metode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tunai">Tunai</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="qris">QRIS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Penerima</Label>
                <Input
                  placeholder="Nama penerima santunan"
                  value={formData.penerima}
                  onChange={(e) => setFormData({ ...formData, penerima: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Catatan</Label>
                <Textarea
                  placeholder="Catatan tambahan..."
                  value={formData.catatan}
                  onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                />
              </div>

              <Button onClick={handleProcess} className="w-full" disabled={submitting}>
                {submitting ? 'Memproses...' : 'Proses Penyaluran'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : santunanList.length === 0 ? (
          <EmptyState
            icon={HandHeart}
            title="Belum ada santunan"
            description="Data santunan akan muncul setelah ada data kematian"
          />
        ) : (
          <DataTable columns={columns} data={santunanList} />
        )}
      </div>
    </AdminLayout>
  );
}
