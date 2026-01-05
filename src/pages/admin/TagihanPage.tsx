import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { ExportButtons } from '@/components/ui/export-buttons';
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
import { Plus, Search, RefreshCw, Edit, Trash2, Receipt, Filter } from 'lucide-react';
import type { IuranTagihan, Anggota, Pengaturan, StatusTagihan } from '@/types/database';
import { formatCurrency, formatDate, formatPeriode, getCurrentPeriode } from '@/lib/format';
import { getErrorMessage, StandardMessages } from '@/lib/error-messages';
import { exportToPDF, exportToExcel } from '@/lib/export';

interface KKData {
  no_kk: string;
  kepala_keluarga: Anggota;
  anggota_count: number;
  rt: string | null;
  rw: string | null;
}

export default function TagihanPage() {
  const [tagihanList, setTagihanList] = useState<IuranTagihan[]>([]);
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodeFilter, setPeriodeFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTagihan, setSelectedTagihan] = useState<IuranTagihan | null>(null);
  const [periode, setPeriode] = useState(getCurrentPeriode());
  const [formData, setFormData] = useState({
    no_kk: '',
    periode: getCurrentPeriode(),
    nominal: '',
    jatuh_tempo: '',
    keterangan: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch tagihan with kepala keluarga info
      const { data: tagihanData } = await supabase
        .from('iuran_tagihan')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch anggota data to join with tagihan
      const { data: anggotaData } = await supabase
        .from('anggota')
        .select('*')
        .eq('status', 'aktif')
        .order('nama_lengkap');

      const { data: pengaturanData } = await supabase
        .from('pengaturan')
        .select('*')
        .limit(1)
        .maybeSingle();

      // Map kepala keluarga to tagihan (menggunakan status_dalam_kk)
      const tagihanWithKK = (tagihanData || []).map(tagihan => {
        const kepala = anggotaData?.find(
          a => a.no_kk === tagihan.no_kk && a.status_dalam_kk === 'kepala_keluarga'
        ) || anggotaData?.find(a => a.no_kk === tagihan.no_kk);
        return { ...tagihan, kepala_keluarga: kepala };
      });

      setTagihanList(tagihanWithKK as IuranTagihan[]);
      setAnggotaList(anggotaData as Anggota[] || []);
      setPengaturan(pengaturanData as Pengaturan);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique KK list with Kepala Keluarga info (menggunakan status_dalam_kk)
  const kkList: KKData[] = anggotaList.reduce((acc, anggota) => {
    if (!acc.find(k => k.no_kk === anggota.no_kk)) {
      const kepalaKeluarga = anggotaList.find(
        a => a.no_kk === anggota.no_kk && a.status_dalam_kk === 'kepala_keluarga'
      ) || anggota;
      acc.push({
        no_kk: anggota.no_kk,
        kepala_keluarga: kepalaKeluarga,
        anggota_count: anggotaList.filter(a => a.no_kk === anggota.no_kk).length,
        rt: kepalaKeluarga.rt,
        rw: kepalaKeluarga.rw,
      });
    }
    return acc;
  }, [] as KKData[]);

  const resetForm = () => {
    setFormData({
      no_kk: '',
      periode: getCurrentPeriode(),
      nominal: pengaturan?.nominal_iuran.toString() || '',
      jatuh_tempo: '',
      keterangan: '',
    });
    setSelectedTagihan(null);
  };

  const openEditDialog = (tagihan: IuranTagihan) => {
    setSelectedTagihan(tagihan);
    setFormData({
      no_kk: tagihan.no_kk,
      periode: tagihan.periode,
      nominal: tagihan.nominal.toString(),
      jatuh_tempo: tagihan.jatuh_tempo,
      keterangan: tagihan.keterangan || '',
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (tagihan: IuranTagihan) => {
    setSelectedTagihan(tagihan);
    setDeleteDialogOpen(true);
  };

  const handleGenerateTagihan = async () => {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const jatuhTempo = new Date(periode + '-28');

      // Check for existing tagihan in this period
      const { data: existingData } = await supabase
        .from('iuran_tagihan')
        .select('no_kk')
        .eq('periode', periode);

      const existingKKs = new Set(existingData?.map(t => t.no_kk) || []);
      
      // Filter KK that don't have tagihan yet
      const newTagihan = kkList
        .filter(kk => !existingKKs.has(kk.no_kk))
        .map(kk => ({
          no_kk: kk.no_kk,
          periode,
          nominal: pengaturan.nominal_iuran,
          status: 'belum_bayar' as StatusTagihan,
          jatuh_tempo: jatuhTempo.toISOString().split('T')[0],
          created_by: user.id,
        }));

      if (newTagihan.length === 0) {
        toast({
          title: 'Info',
          description: 'Semua tagihan untuk periode ini sudah dibuat',
        });
        setGenerateDialogOpen(false);
        return;
      }

      const { error } = await supabase.from('iuran_tagihan').insert(newTagihan);
      if (error) throw error;

      toast({
        title: '✓ Tagihan Berhasil Dibuat',
        description: `${newTagihan.length} tagihan berhasil dibuat untuk periode ${formatPeriode(periode)}.`,
      });
      setGenerateDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Membuat Tagihan',
        description: getErrorMessage(error, StandardMessages.error.save),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.no_kk || !formData.periode || !formData.nominal || !formData.jatuh_tempo) {
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
      if (!user) throw new Error('User not authenticated');

      if (selectedTagihan) {
        const { error } = await supabase
          .from('iuran_tagihan')
          .update({
            no_kk: formData.no_kk,
            periode: formData.periode,
            nominal: parseInt(formData.nominal),
            jatuh_tempo: formData.jatuh_tempo,
            keterangan: formData.keterangan || null,
          })
          .eq('id', selectedTagihan.id);

        if (error) throw error;
        toast({ title: '✓ Tagihan Diperbarui', description: 'Data tagihan berhasil diperbarui.' });
      } else {
        // Check for duplicate
        const { data: existing } = await supabase
          .from('iuran_tagihan')
          .select('id')
          .eq('no_kk', formData.no_kk)
          .eq('periode', formData.periode)
          .maybeSingle();

        if (existing) {
          toast({
            variant: 'destructive',
            title: 'Tagihan Sudah Ada',
            description: 'KK ini sudah memiliki tagihan untuk periode ini.',
          });
          setSubmitting(false);
          return;
        }

        const { error } = await supabase.from('iuran_tagihan').insert([{
          no_kk: formData.no_kk,
          periode: formData.periode,
          nominal: parseInt(formData.nominal),
          status: 'belum_bayar' as StatusTagihan,
          jatuh_tempo: formData.jatuh_tempo,
          keterangan: formData.keterangan || null,
          created_by: user.id,
        }]);

        if (error) throw error;
        toast({ title: '✓ Tagihan Ditambahkan', description: 'Tagihan baru berhasil dibuat.' });
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
    if (!selectedTagihan) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('iuran_tagihan')
        .delete()
        .eq('id', selectedTagihan.id);

      if (error) throw error;
      toast({ title: '✓ Tagihan Dihapus', description: 'Tagihan berhasil dihapus.' });
      setDeleteDialogOpen(false);
      setSelectedTagihan(null);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Menghapus',
        description: getErrorMessage(error, 'Data tidak dapat dihapus karena sudah memiliki pembayaran.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Available periods for filter
  const availablePeriodes = useMemo(() => {
    const periodes = new Set<string>();
    tagihanList.forEach(t => periodes.add(t.periode));
    return Array.from(periodes).sort().reverse();
  }, [tagihanList]);

  const filteredTagihan = tagihanList.filter((t) => {
    const matchSearch = 
      t.kepala_keluarga?.nama_lengkap?.toLowerCase().includes(search.toLowerCase()) ||
      t.no_kk?.includes(search) ||
      t.periode.includes(search);
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchPeriode = periodeFilter === 'all' || t.periode === periodeFilter;
    return matchSearch && matchStatus && matchPeriode;
  });

  // Export columns
  const exportColumns = [
    { key: 'no_kk', header: 'No. KK' },
    { key: 'kepala_keluarga', header: 'Kepala Keluarga', format: (_: any, row: IuranTagihan) => row.kepala_keluarga?.nama_lengkap || '-' },
    { key: 'rt', header: 'RT', format: (_: any, row: IuranTagihan) => row.kepala_keluarga?.rt || '-' },
    { key: 'rw', header: 'RW', format: (_: any, row: IuranTagihan) => row.kepala_keluarga?.rw || '-' },
    { key: 'periode', header: 'Periode', format: (v: string) => formatPeriode(v) },
    { key: 'nominal', header: 'Nominal', format: (v: number) => formatCurrency(v) },
    { key: 'jatuh_tempo', header: 'Jatuh Tempo', format: (v: string) => formatDate(v) },
    { key: 'status', header: 'Status', format: (v: string) => v === 'lunas' ? 'Lunas' : v === 'menunggu_admin' ? 'Menunggu Admin' : 'Belum Bayar' },
  ];

  const handleExportPDF = () => {
    const title = periodeFilter !== 'all' 
      ? `Laporan Tagihan RUKEM - ${formatPeriode(periodeFilter)}`
      : 'Laporan Tagihan RUKEM - Semua Periode';
    const filename = periodeFilter !== 'all'
      ? `tagihan-${periodeFilter}`
      : 'tagihan-semua-periode';
    exportToPDF(filteredTagihan, exportColumns, title, filename);
  };

  const handleExportExcel = () => {
    const filename = periodeFilter !== 'all'
      ? `tagihan-${periodeFilter}`
      : 'tagihan-semua-periode';
    exportToExcel(filteredTagihan, exportColumns, 'Tagihan', filename);
  };

  const columns = [
    {
      key: 'no_kk',
      header: 'Kartu Keluarga',
      cell: (item: IuranTagihan) => (
        <div>
          <p className="font-medium">{item.kepala_keluarga?.nama_lengkap || '-'}</p>
          <p className="text-xs text-muted-foreground font-mono">{item.no_kk}</p>
          {item.kepala_keluarga?.rt && (
            <p className="text-xs text-muted-foreground">
              RT {item.kepala_keluarga.rt}/RW {item.kepala_keluarga.rw}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'periode',
      header: 'Periode',
      cell: (item: IuranTagihan) => formatPeriode(item.periode),
    },
    {
      key: 'nominal',
      header: 'Nominal',
      cell: (item: IuranTagihan) => formatCurrency(item.nominal),
      className: 'hidden md:table-cell',
    },
    {
      key: 'jatuh_tempo',
      header: 'Jatuh Tempo',
      cell: (item: IuranTagihan) => formatDate(item.jatuh_tempo),
      className: 'hidden md:table-cell',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: IuranTagihan) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: '',
      cell: (item: IuranTagihan) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              openEditDialog(item);
            }}
            disabled={item.status === 'lunas'}
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
            disabled={item.status !== 'belum_bayar'}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <PageHeader title="Tagihan per KK" description="Kelola tagihan iuran per Kartu Keluarga" />
        <AdminIuranSkeleton />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <PageHeader title="Tagihan per KK" description="Kelola tagihan iuran per Kartu Keluarga. Tagihan dihitung dari KK Aktif (yang memiliki Kepala Keluarga).">
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => {
                resetForm();
                if (pengaturan) {
                  setFormData(prev => ({ 
                    ...prev, 
                    nominal: pengaturan.nominal_iuran.toString(),
                    jatuh_tempo: `${getCurrentPeriode()}-28`,
                  }));
                }
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Tagihan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedTagihan ? 'Edit Tagihan' : 'Tambah Tagihan'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Kartu Keluarga <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.no_kk}
                    onValueChange={(value) => setFormData({ ...formData, no_kk: value })}
                    disabled={!!selectedTagihan}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih KK" />
                    </SelectTrigger>
                    <SelectContent>
                      {kkList.map((kk) => (
                        <SelectItem key={kk.no_kk} value={kk.no_kk}>
                          <div className="flex flex-col">
                            <span>{kk.kepala_keluarga.nama_lengkap}</span>
                            <span className="text-xs text-muted-foreground">
                              {kk.no_kk} • {kk.anggota_count} anggota
                              {kk.rt && ` • RT ${kk.rt}/RW ${kk.rw}`}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Periode <span className="text-destructive">*</span></Label>
                  <Input
                    type="month"
                    value={formData.periode}
                    onChange={(e) => setFormData({ ...formData, periode: e.target.value })}
                    disabled={!!selectedTagihan}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Nominal <span className="text-destructive">*</span></Label>
                    <Input
                      type="number"
                      value={formData.nominal}
                      onChange={(e) => setFormData({ ...formData, nominal: e.target.value })}
                      placeholder="50000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Jatuh Tempo <span className="text-destructive">*</span></Label>
                    <Input
                      type="date"
                      value={formData.jatuh_tempo}
                      onChange={(e) => setFormData({ ...formData, jatuh_tempo: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Keterangan</Label>
                  <Textarea
                    value={formData.keterangan}
                    onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                    placeholder="Keterangan tambahan (opsional)"
                    rows={2}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate Tagihan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Tagihan Otomatis</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Buat tagihan iuran untuk semua KK yang belum memiliki tagihan pada periode tertentu.
                </p>
                <div className="space-y-1.5">
                  <Label>Periode</Label>
                  <Input
                    type="month"
                    value={periode}
                    onChange={(e) => setPeriode(e.target.value)}
                  />
                </div>
                <div className="bg-muted p-3 rounded-lg text-sm">
                  <p><strong>Total KK:</strong> {kkList.length}</p>
                  <p><strong>Nominal per KK:</strong> {formatCurrency(pengaturan?.nominal_iuran || 0)}</p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
                    Batal
                  </Button>
                  <Button onClick={handleGenerateTagihan} disabled={submitting}>
                    {submitting ? 'Memproses...' : 'Generate'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <div className="mt-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, no KK..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={periodeFilter} onValueChange={setPeriodeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Periode</SelectItem>
              {availablePeriodes.map((p) => (
                <SelectItem key={p} value={p}>{formatPeriode(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="belum_bayar">Belum Bayar</SelectItem>
              <SelectItem value="menunggu_admin">Menunggu Admin</SelectItem>
              <SelectItem value="lunas">Lunas</SelectItem>
            </SelectContent>
          </Select>
          <ExportButtons
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
            disabled={filteredTagihan.length === 0}
          />
        </div>

        {filteredTagihan.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Belum Ada Tagihan"
            description="Klik tombol 'Generate Tagihan' untuk membuat tagihan otomatis atau tambah manual."
          />
        ) : (
          <DataTable columns={columns} data={filteredTagihan} />
        )}
      </div>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Hapus Tagihan"
        description="Apakah Anda yakin ingin menghapus tagihan ini? Tindakan ini tidak dapat dibatalkan."
        loading={submitting}
      />
    </AdminLayout>
  );
}
