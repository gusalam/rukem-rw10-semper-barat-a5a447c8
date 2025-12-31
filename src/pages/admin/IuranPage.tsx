import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { AdminIuranSkeleton } from '@/components/ui/admin-loading-skeleton';
import { useFormValidation } from '@/components/ui/form-field';
import { SecureImage } from '@/components/ui/secure-image';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Plus, Search, Receipt, RefreshCw, CheckCircle, XCircle, Eye, Edit, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Iuran, Anggota, Pengaturan, PembayaranIuran, StatusIuran } from '@/types/database';
import { formatCurrency, formatDate, formatPeriode, getCurrentPeriode } from '@/lib/format';
import { getErrorMessage, StandardMessages } from '@/lib/error-messages';
import { z } from 'zod';
import { cn } from '@/lib/utils';

// Validation schema for iuran form
const iuranSchema = z.object({
  no_kk: z.string().min(1, 'KK wajib dipilih'),
  periode: z.string().min(1, 'Periode wajib diisi'),
  nominal: z.string().min(1, 'Nominal wajib diisi').refine(val => parseInt(val) > 0, 'Nominal harus lebih dari 0'),
  status: z.string(),
});

type IuranFormData = z.infer<typeof iuranSchema>;

export default function IuranPage() {
  const [iuranList, setIuranList] = useState<Iuran[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PembayaranIuran[]>([]);
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PembayaranIuran | null>(null);
  const [selectedIuran, setSelectedIuran] = useState<Iuran | null>(null);
  const [periode, setPeriode] = useState(getCurrentPeriode());
  const [formData, setFormData] = useState<IuranFormData>({
    no_kk: '',
    periode: getCurrentPeriode(),
    nominal: '',
    status: 'belum_bayar',
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  
  // Real-time validation
  const validation = useFormValidation(formData, iuranSchema);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [iuranRes, anggotaRes, pengaturanRes, pendingRes] = await Promise.all([
        supabase.from('iuran').select('*, anggota(*)').order('jatuh_tempo', { ascending: false }),
        supabase.from('anggota').select('*').eq('status', 'aktif').order('nama_lengkap'),
        supabase.from('pengaturan').select('*').limit(1).maybeSingle(),
        supabase.from('pembayaran_iuran')
          .select('*, iuran(*), anggota(*)')
          .is('verified_at', null)
          .is('alasan_tolak', null)
          .order('created_at', { ascending: false }),
      ]);

      setIuranList(iuranRes.data as Iuran[] || []);
      setAnggotaList(anggotaRes.data as Anggota[] || []);
      setPengaturan(pengaturanRes.data as Pengaturan);
      setPendingPayments(pendingRes.data as PembayaranIuran[] || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      no_kk: '',
      periode: getCurrentPeriode(),
      nominal: pengaturan?.nominal_iuran.toString() || '',
      status: 'belum_bayar',
    });
    setSelectedIuran(null);
    validation.resetValidation();
  };

  // Get unique KK list with Kepala Keluarga info
  const kkList = anggotaList.reduce((acc, anggota) => {
    if (!acc.find(k => k.no_kk === anggota.no_kk)) {
      const kepalaKeluarga = anggotaList.find(a => a.no_kk === anggota.no_kk && a.hubungan_kk === 'Kepala Keluarga');
      acc.push({
        no_kk: anggota.no_kk,
        kepala_keluarga: kepalaKeluarga || anggota,
        anggota_count: anggotaList.filter(a => a.no_kk === anggota.no_kk).length,
      });
    }
    return acc;
  }, [] as { no_kk: string; kepala_keluarga: Anggota; anggota_count: number }[]);

  const openEditDialog = (iuran: Iuran) => {
    setSelectedIuran(iuran);
    setFormData({
      no_kk: iuran.no_kk || iuran.anggota?.no_kk || '',
      periode: iuran.periode,
      nominal: iuran.nominal.toString(),
      status: iuran.status,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (iuran: Iuran) => {
    setSelectedIuran(iuran);
    setDeleteDialogOpen(true);
  };

  const handleGenerateIuran = async () => {
    if (!pengaturan) {
      toast({
        variant: 'destructive',
        title: 'Pengaturan Belum Ada',
        description: 'Silakan konfigurasi pengaturan iuran terlebih dahulu.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const jatuhTempo = new Date(periode + '-28');
      
      // Generate iuran per KK (using Kepala Keluarga as anggota_id)
      const iuranToInsert = kkList.map(kk => ({
        anggota_id: kk.kepala_keluarga.id,
        no_kk: kk.no_kk,
        periode,
        jenis: 'bulanan' as const,
        nominal: pengaturan.nominal_iuran,
        status: 'belum_bayar' as const,
        jatuh_tempo: jatuhTempo.toISOString().split('T')[0],
      }));

      // Check for existing iuran in this period by KK
      const existingCheck = await supabase
        .from('iuran')
        .select('no_kk')
        .eq('periode', periode);

      const existingKKs = new Set(existingCheck.data?.map(i => i.no_kk) || []);
      const newIuran = iuranToInsert.filter(i => !existingKKs.has(i.no_kk));

      if (newIuran.length === 0) {
        toast({
          title: 'Info',
          description: 'Semua iuran untuk periode ini sudah dibuat',
        });
        setGenerateDialogOpen(false);
        return;
      }

      const { error } = await supabase.from('iuran').insert(newIuran);
      if (error) throw error;

      toast({
        title: '✓ Iuran Berhasil Dibuat',
        description: StandardMessages.success.iuran.generate(newIuran.length, formatPeriode(periode)),
      });
      setGenerateDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Membuat Iuran',
        description: getErrorMessage(error, StandardMessages.error.save),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.no_kk || !formData.periode || !formData.nominal) {
      toast({
        variant: 'destructive',
        title: 'Data Belum Lengkap',
        description: StandardMessages.validation.required,
      });
      return;
    }

    // Find Kepala Keluarga for this KK
    const kepalaKeluarga = anggotaList.find(a => a.no_kk === formData.no_kk && a.hubungan_kk === 'Kepala Keluarga')
      || anggotaList.find(a => a.no_kk === formData.no_kk);
    
    if (!kepalaKeluarga) {
      toast({
        variant: 'destructive',
        title: 'KK Tidak Valid',
        description: 'Tidak ditemukan anggota untuk KK ini.',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (selectedIuran) {
        const { error } = await supabase
          .from('iuran')
          .update({
            no_kk: formData.no_kk,
            anggota_id: kepalaKeluarga.id,
            periode: formData.periode,
            nominal: parseInt(formData.nominal),
            status: formData.status as StatusIuran,
          })
          .eq('id', selectedIuran.id);

        if (error) throw error;
        toast({ title: '✓ Iuran Diperbarui', description: StandardMessages.success.iuran.update });
      } else {
        const jatuhTempo = new Date(formData.periode + '-28');
        const { error } = await supabase.from('iuran').insert([{
          anggota_id: kepalaKeluarga.id,
          no_kk: formData.no_kk,
          periode: formData.periode,
          jenis: 'bulanan' as const,
          nominal: parseInt(formData.nominal),
          status: formData.status as StatusIuran,
          jatuh_tempo: jatuhTempo.toISOString().split('T')[0],
        }]);

        if (error) throw error;
        toast({ title: '✓ Iuran Ditambahkan', description: StandardMessages.success.iuran.add });
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
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
    if (!selectedIuran) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('iuran')
        .delete()
        .eq('id', selectedIuran.id);

      if (error) throw error;
      toast({ title: '✓ Iuran Dihapus', description: StandardMessages.success.iuran.delete });
      setDeleteDialogOpen(false);
      setSelectedIuran(null);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Menghapus',
        description: getErrorMessage(error, 'Data tidak dapat dihapus karena masih digunakan oleh data lain.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyPayment = async (approved: boolean) => {
    if (!selectedPayment) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (approved) {
        // Update payment - trigger will handle iuran status update and kas insert
        await supabase
          .from('pembayaran_iuran')
          .update({
            verified_by: user?.id,
            verified_at: new Date().toISOString(),
          })
          .eq('id', selectedPayment.id);

        toast({ title: '✓ Pembayaran Diverifikasi', description: StandardMessages.success.iuran.verify });
      } else {
        // Reject payment
        await supabase
          .from('pembayaran_iuran')
          .update({ alasan_tolak: 'Bukti tidak valid' })
          .eq('id', selectedPayment.id);

        await supabase
          .from('iuran')
          .update({ status: 'ditolak' })
          .eq('id', selectedPayment.iuran_id);

        toast({ title: '✗ Pembayaran Ditolak', description: StandardMessages.success.iuran.reject });
      }

      setVerifyDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Memproses',
        description: getErrorMessage(error, StandardMessages.error.system),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredIuran = iuranList.filter((i) => {
    const matchSearch = i.anggota?.nama_lengkap?.toLowerCase().includes(search.toLowerCase()) ||
      i.no_kk?.includes(search) ||
      i.periode.includes(search);
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const iuranColumns = [
    {
      key: 'no_kk',
      header: 'No. KK',
      cell: (item: Iuran) => (
        <div>
          <p className="font-medium">{item.no_kk || item.anggota?.no_kk || '-'}</p>
          <p className="text-xs text-muted-foreground">{item.anggota?.nama_lengkap}</p>
        </div>
      ),
    },
    {
      key: 'periode',
      header: 'Periode',
      cell: (item: Iuran) => formatPeriode(item.periode),
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: Iuran) => formatCurrency(item.nominal),
      className: 'hidden md:table-cell',
    },
    {
      key: 'jatuh_tempo',
      header: 'Jatuh Tempo',
      cell: (item: Iuran) => formatDate(item.jatuh_tempo),
      className: 'hidden md:table-cell',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: Iuran) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: '',
      cell: (item: Iuran) => (
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

  const pendingColumns = [
    {
      key: 'anggota',
      header: 'Anggota',
      cell: (item: PembayaranIuran) => item.anggota?.nama_lengkap || '-',
    },
    {
      key: 'periode',
      header: 'Periode',
      cell: (item: PembayaranIuran) => item.iuran ? formatPeriode(item.iuran.periode) : '-',
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: PembayaranIuran) => formatCurrency(item.nominal),
    },
    {
      key: 'tanggal',
      header: 'Tanggal',
      cell: (item: PembayaranIuran) => formatDate(item.tanggal_bayar),
      className: 'hidden md:table-cell',
    },
    {
      key: 'actions',
      header: '',
      cell: (item: PembayaranIuran) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedPayment(item);
            setVerifyDialogOpen(true);
          }}
        >
          <Eye className="h-4 w-4 mr-1" />
          Verifikasi
        </Button>
      ),
    },
  ];

  return (
    <AdminLayout>
      <PageHeader title="Manajemen Iuran" description="Kelola tagihan iuran anggota">
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => {
                resetForm();
                if (pengaturan) {
                  setFormData(prev => ({ ...prev, nominal: pengaturan.nominal_iuran.toString() }));
                }
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Iuran
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedIuran ? 'Edit Iuran' : 'Tambah Iuran'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className={cn(validation.getFieldError('no_kk') && "text-destructive")}>
                    Kartu Keluarga <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.no_kk}
                    onValueChange={(value) => {
                      setFormData({ ...formData, no_kk: value });
                      validation.markTouched('no_kk');
                    }}
                  >
                    <SelectTrigger className={cn(
                      validation.getFieldError('no_kk') && "border-destructive",
                      validation.isFieldValid('no_kk') && "border-success"
                    )}>
                      <SelectValue placeholder="Pilih KK" />
                    </SelectTrigger>
                    <SelectContent>
                      {kkList.map((kk) => (
                        <SelectItem key={kk.no_kk} value={kk.no_kk}>
                          {kk.no_kk} - {kk.kepala_keluarga.nama_lengkap} ({kk.anggota_count} anggota)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validation.getFieldError('no_kk') && (
                    <p className="text-xs text-destructive animate-in slide-in-from-top-1 fade-in duration-200">
                      {validation.getFieldError('no_kk')}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className={cn(validation.getFieldError('periode') && "text-destructive")}>
                    Periode <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type="month"
                      value={formData.periode}
                      onChange={(e) => setFormData({ ...formData, periode: e.target.value })}
                      onBlur={() => { validation.markTouched('periode'); validation.validateField('periode'); }}
                      className={cn(
                        "pr-10",
                        validation.getFieldError('periode') && "border-destructive",
                        validation.isFieldValid('periode') && "border-success"
                      )}
                    />
                    {(validation.getFieldError('periode') || validation.isFieldValid('periode')) && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {validation.getFieldError('periode') ? (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        )}
                      </div>
                    )}
                  </div>
                  {validation.getFieldError('periode') && (
                    <p className="text-xs text-destructive animate-in slide-in-from-top-1 fade-in duration-200">
                      {validation.getFieldError('periode')}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className={cn(validation.getFieldError('nominal') && "text-destructive")}>
                    Nominal <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={formData.nominal}
                      onChange={(e) => setFormData({ ...formData, nominal: e.target.value })}
                      onBlur={() => { validation.markTouched('nominal'); validation.validateField('nominal'); }}
                      placeholder="0"
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
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
                      <SelectItem value="menunggu_verifikasi">Menunggu Verifikasi</SelectItem>
                      <SelectItem value="lunas">Lunas</SelectItem>
                      <SelectItem value="ditolak">Ditolak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : selectedIuran ? 'Simpan Perubahan' : 'Tambah Iuran'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate Iuran
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Iuran Bulanan</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Periode</Label>
                  <Input
                    type="month"
                    value={periode}
                    onChange={(e) => setPeriode(e.target.value)}
                  />
                </div>
                <div className="p-4 bg-muted rounded-lg text-sm">
                  <p>Akan membuat iuran untuk <strong>{kkList.length}</strong> KK (Kartu Keluarga)</p>
                  <p className="mt-1">Nominal per KK: <strong>{pengaturan ? formatCurrency(pengaturan.nominal_iuran) : '-'}</strong></p>
                </div>
                <Button onClick={handleGenerateIuran} className="w-full" disabled={submitting}>
                  {submitting ? 'Memproses...' : 'Generate Iuran'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {/* Verify Payment Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verifikasi Pembayaran</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Anggota</span>
                  <span className="font-medium">{selectedPayment.anggota?.nama_lengkap}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Periode</span>
                  <span>{selectedPayment.iuran ? formatPeriode(selectedPayment.iuran.periode) : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nominal</span>
                  <span className="font-bold text-primary">{formatCurrency(selectedPayment.nominal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Metode</span>
                  <span className="capitalize">{selectedPayment.metode}</span>
                </div>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <SecureImage
                  bucketName="bukti_pembayaran"
                  filePath={selectedPayment.bukti_url}
                  alt="Bukti pembayaran"
                  className="w-full max-h-64 object-contain bg-muted"
                  fallbackClassName="min-h-48"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleVerifyPayment(false)}
                  disabled={submitting}
                >
                  <XCircle className="h-4 w-4 mr-2 text-destructive" />
                  Tolak
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleVerifyPayment(true)}
                  disabled={submitting}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Setujui
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Hapus Iuran?"
        description="Iuran yang dihapus tidak dapat dikembalikan."
        loading={submitting}
      />

      <Tabs defaultValue="iuran" className="mt-6">
        <TabsList>
          <TabsTrigger value="iuran">Daftar Iuran</TabsTrigger>
          <TabsTrigger value="pending">
            Verifikasi
            {pendingPayments.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-warning text-warning-foreground rounded-full">
                {pendingPayments.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="iuran" className="mt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau periode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
                <SelectItem value="menunggu_verifikasi">Menunggu Verifikasi</SelectItem>
                <SelectItem value="lunas">Lunas</SelectItem>
                <SelectItem value="ditolak">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <AdminIuranSkeleton />
          ) : filteredIuran.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Belum ada iuran"
              description="Generate iuran bulanan untuk memulai"
            />
          ) : (
            <DataTable columns={iuranColumns} data={filteredIuran} />
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          {pendingPayments.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="Tidak ada pembayaran pending"
              description="Semua pembayaran sudah diverifikasi"
            />
          ) : (
            <DataTable columns={pendingColumns} data={pendingPayments} />
          )}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
