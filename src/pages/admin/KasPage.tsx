import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { AdminKasSkeleton } from '@/components/ui/admin-loading-skeleton';
import { useFormValidation } from '@/components/ui/form-field';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Wallet, TrendingUp, TrendingDown, DollarSign, Edit, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Kas, JenisKas } from '@/types/database';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { getErrorMessage, StandardMessages } from '@/lib/error-messages';
import { z } from 'zod';
import { cn } from '@/lib/utils';

// Validation schema for kas form
const kasSchema = z.object({
  jenis: z.string(),
  nominal: z.string().min(1, 'Nominal wajib diisi').refine(val => parseInt(val) > 0, 'Nominal harus lebih dari 0'),
  keterangan: z.string().min(3, 'Keterangan minimal 3 karakter'),
});

type KasFormData = z.infer<typeof kasSchema>;

export default function KasPage() {
  const [kasList, setKasList] = useState<Kas[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKas, setSelectedKas] = useState<Kas | null>(null);
  const [formData, setFormData] = useState<KasFormData>({
    jenis: 'pemasukan',
    nominal: '',
    keterangan: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  
  // Real-time validation
  const validation = useFormValidation(formData, kasSchema);

  useEffect(() => {
    fetchKas();
  }, []);

  const fetchKas = async () => {
    try {
      const { data, error } = await supabase
        .from('kas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKasList(data as Kas[]);
    } catch (error) {
      console.error('Error fetching kas:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ jenis: 'pemasukan', nominal: '', keterangan: '' });
    setSelectedKas(null);
    validation.resetValidation();
  };

  const openEditDialog = (kas: Kas) => {
    setSelectedKas(kas);
    setFormData({
      jenis: kas.jenis,
      nominal: kas.nominal.toString(),
      keterangan: kas.keterangan,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (kas: Kas) => {
    setSelectedKas(kas);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nominal || !formData.keterangan) {
      toast({
        variant: 'destructive',
        title: 'Data Belum Lengkap',
        description: StandardMessages.validation.required,
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (selectedKas) {
        // Update existing
        const { error } = await supabase
          .from('kas')
          .update({
            jenis: formData.jenis as JenisKas,
            nominal: parseInt(formData.nominal),
            keterangan: formData.keterangan,
          })
          .eq('id', selectedKas.id);

        if (error) throw error;
        toast({ title: '✓ Transaksi Diperbarui', description: StandardMessages.success.kas.update });
      } else {
        // Create new
        const { error } = await supabase.from('kas').insert([{
          jenis: formData.jenis as JenisKas,
          nominal: parseInt(formData.nominal),
          keterangan: formData.keterangan,
          created_by: user?.id,
        }]);

        if (error) throw error;
        toast({ title: '✓ Transaksi Dicatat', description: StandardMessages.success.kas.add });
      }

      setDialogOpen(false);
      resetForm();
      fetchKas();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Menyimpan',
        description: getErrorMessage(error, StandardMessages.error.save),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedKas) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('kas')
        .delete()
        .eq('id', selectedKas.id);

      if (error) throw error;
      toast({ title: '✓ Transaksi Dihapus', description: StandardMessages.success.kas.delete });
      setDeleteDialogOpen(false);
      setSelectedKas(null);
      fetchKas();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Menghapus',
        description: getErrorMessage(error, StandardMessages.error.delete),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalPemasukan = kasList.filter(k => k.jenis === 'pemasukan').reduce((sum, k) => sum + k.nominal, 0);
  const totalPengeluaran = kasList.filter(k => k.jenis === 'pengeluaran').reduce((sum, k) => sum + k.nominal, 0);
  const saldo = totalPemasukan - totalPengeluaran;

  const columns = [
    {
      key: 'created_at',
      header: 'Tanggal',
      cell: (item: Kas) => formatDateTime(item.created_at),
      className: 'hidden md:table-cell',
    },
    {
      key: 'keterangan',
      header: 'Keterangan',
      cell: (item: Kas) => (
        <div className="max-w-[200px] truncate">{item.keterangan}</div>
      ),
    },
    {
      key: 'jenis',
      header: 'Jenis',
      cell: (item: Kas) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          item.jenis === 'pemasukan' 
            ? 'bg-success/10 text-success' 
            : 'bg-destructive/10 text-destructive'
        }`}>
          {item.jenis === 'pemasukan' ? 'Masuk' : 'Keluar'}
        </span>
      ),
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: Kas) => (
        <span className={item.jenis === 'pemasukan' ? 'text-success font-medium' : 'text-destructive font-medium'}>
          {item.jenis === 'pemasukan' ? '+' : '-'}{formatCurrency(item.nominal)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (item: Kas) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              openEditDialog(item);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              openDeleteDialog(item);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      <PageHeader title="Manajemen Kas" description="Kelola pemasukan dan pengeluaran kas RUKEM">
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Transaksi
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedKas ? 'Edit Transaksi Kas' : 'Tambah Transaksi Kas'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Jenis Transaksi</Label>
                <Select
                  value={formData.jenis}
                  onValueChange={(value) => setFormData({ ...formData, jenis: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pemasukan">Pemasukan</SelectItem>
                    <SelectItem value="pengeluaran">Pengeluaran</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={cn(validation.getFieldError('nominal') && "text-destructive")}>
                  Nominal <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.nominal}
                    onChange={(e) => setFormData({ ...formData, nominal: e.target.value })}
                    onBlur={() => { validation.markTouched('nominal'); validation.validateField('nominal'); }}
                    className={cn(
                      "pr-10",
                      validation.getFieldError('nominal') && "border-destructive",
                      validation.isFieldValid('nominal') && "border-success"
                    )}
                  />
                  {(validation.getFieldError('nominal') || validation.isFieldValid('nominal')) && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {validation.getFieldError('nominal') ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      )}
                    </div>
                  )}
                </div>
                {validation.getFieldError('nominal') && (
                  <p className="text-xs text-destructive animate-in slide-in-from-top-1 fade-in duration-200">
                    {validation.getFieldError('nominal')}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className={cn(validation.getFieldError('keterangan') && "text-destructive")}>
                  Keterangan <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Textarea
                    placeholder="Contoh: Donasi dari Bapak Ahmad"
                    value={formData.keterangan}
                    onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                    onBlur={() => { validation.markTouched('keterangan'); validation.validateField('keterangan'); }}
                    className={cn(
                      validation.getFieldError('keterangan') && "border-destructive",
                      validation.isFieldValid('keterangan') && "border-success"
                    )}
                  />
                </div>
                {validation.getFieldError('keterangan') && (
                  <p className="text-xs text-destructive animate-in slide-in-from-top-1 fade-in duration-200">
                    {validation.getFieldError('keterangan')}
                  </p>
                )}
                {!validation.getFieldError('keterangan') && formData.keterangan.length > 0 && formData.keterangan.length < 3 && (
                  <p className="text-xs text-muted-foreground">{formData.keterangan.length}/3 karakter minimum</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Menyimpan...' : selectedKas ? 'Simpan Perubahan' : 'Simpan Transaksi'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Hapus Transaksi Kas?"
        description="Transaksi kas yang dihapus tidak dapat dikembalikan."
        loading={submitting}
      />

      <div className="grid gap-4 md:grid-cols-3 mt-6">
        <StatCard
          title="Total Pemasukan"
          value={formatCurrency(totalPemasukan)}
          icon={TrendingUp}
          iconClassName="bg-success/10"
        />
        <StatCard
          title="Total Pengeluaran"
          value={formatCurrency(totalPengeluaran)}
          icon={TrendingDown}
          iconClassName="bg-destructive/10"
        />
        <StatCard
          title="Saldo Kas"
          value={formatCurrency(saldo)}
          icon={DollarSign}
          iconClassName="bg-primary/10"
        />
      </div>

      <div className="mt-6">
        {loading ? (
          <AdminKasSkeleton />
        ) : kasList.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Belum ada transaksi"
            description="Mulai tambahkan transaksi kas untuk mencatat pemasukan dan pengeluaran"
          />
        ) : (
          <DataTable columns={columns} data={kasList} />
        )}
      </div>
    </AdminLayout>
  );
}
