import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { TablePagination } from '@/components/ui/table-pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { ImportAnggotaDialog } from '@/components/admin/ImportAnggotaDialog';
import { FixStatusAnggotaDialog } from '@/components/admin/FixStatusAnggotaDialog';
import { AdminAnggotaSkeleton } from '@/components/ui/admin-loading-skeleton';
import { useToast } from '@/hooks/use-toast';
import { useFormValidation } from '@/components/ui/form-field';
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
import { Plus, Search, Users, Edit, KeyRound, Trash2, Upload, X, AlertCircle, CheckCircle2, Wrench } from 'lucide-react';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { ExportButtons } from '@/components/ui/export-buttons';
import { exportToPDF, exportToExcel } from '@/lib/export';
import type { Anggota } from '@/types/database';
import { formatPhoneNumber } from '@/lib/format';
import { getErrorMessage, StandardMessages } from '@/lib/error-messages';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-mobile';

const AGAMA_OPTIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'];
const STATUS_PERKAWINAN_OPTIONS = ['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati'];
const HUBUNGAN_KK_OPTIONS = ['Kepala Keluarga', 'Istri', 'Anak', 'Orang Tua', 'Anggota Keluarga Lainnya'];
const STATUS_ANGGOTA_OPTIONS = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'nonaktif', label: 'Tidak Aktif' },
  { value: 'meninggal', label: 'Meninggal' },
] as const;

const anggotaSchema = z.object({
  nama_lengkap: z.string().min(3, 'Nama minimal 3 karakter'),
  nik: z.string().length(16, 'NIK harus 16 digit'),
  no_kk: z.string().length(16, 'No KK harus 16 digit'),
  jenis_kelamin: z.string().min(1, 'Jenis kelamin wajib diisi'),
  tempat_lahir: z.string().min(2, 'Tempat lahir wajib diisi'),
  tanggal_lahir: z.string().min(1, 'Tanggal lahir wajib diisi'),
  agama: z.string().min(1, 'Agama wajib diisi'),
  status_perkawinan: z.string().min(1, 'Status perkawinan wajib diisi'),
  pekerjaan: z.string().min(2, 'Pekerjaan wajib diisi'),
  hubungan_kk: z.string().min(1, 'Status hubungan dalam KK wajib diisi'),
  alamat: z.string().min(5, 'Alamat lengkap wajib diisi'),
  rt: z.string().min(1, 'RT wajib diisi'),
  rw: z.string().min(1, 'RW wajib diisi'),
  kelurahan: z.string().min(2, 'Kelurahan/Desa wajib diisi'),
  kecamatan: z.string().min(2, 'Kecamatan wajib diisi'),
  kabupaten_kota: z.string().min(2, 'Kabupaten/Kota wajib diisi'),
  provinsi: z.string().min(2, 'Provinsi wajib diisi'),
  no_hp: z.string().min(10, 'No HP minimal 10 digit'),
  status: z.enum(['aktif', 'nonaktif', 'meninggal'], { required_error: 'Status anggota wajib diisi' }),
});

type FormData = z.infer<typeof anggotaSchema>;

const emptyFormData: FormData = {
  nama_lengkap: '',
  nik: '',
  no_kk: '',
  jenis_kelamin: '',
  tempat_lahir: '',
  tanggal_lahir: '',
  agama: '',
  status_perkawinan: '',
  pekerjaan: '',
  hubungan_kk: '',
  alamat: '',
  rt: '',
  rw: '',
  kelurahan: '',
  kecamatan: '',
  kabupaten_kota: '',
  provinsi: '',
  no_hp: '',
  status: 'aktif', // Default status untuk anggota baru
};

export default function AnggotaPage() {
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKK, setFilterKK] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [fixStatusDialogOpen, setFixStatusDialogOpen] = useState(false);
  const [selectedAnggota, setSelectedAnggota] = useState<Anggota | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [accountData, setAccountData] = useState({
    email: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  
  // Debounced search for server-side filtering
  const debouncedSearch = useDebounce(search, 300);
  
  // Real-time validation hook
  const validation = useFormValidation(formData, anggotaSchema);

  // Fetch anggota with pagination
  const fetchAnggota = useCallback(async () => {
    setLoading(true);
    try {
      // Build query with filters
      let query = supabase
        .from('anggota')
        .select('*', { count: 'exact' });
      
      // Apply search filter (server-side)
      if (debouncedSearch) {
        query = query.or(
          `nama_lengkap.ilike.%${debouncedSearch}%,nik.ilike.%${debouncedSearch}%,no_kk.ilike.%${debouncedSearch}%,no_hp.ilike.%${debouncedSearch}%`
        );
      }
      
      // Apply KK filter
      if (filterKK) {
        query = query.eq('no_kk', filterKK);
      }
      
      // Apply pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, count, error } = await query
        .order('nama_lengkap')
        .range(from, to);

      if (error) throw error;
      
      setAnggotaList(data as Anggota[]);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching anggota:', error);
      toast({
        variant: 'destructive',
        title: 'Gagal Memuat Data',
        description: StandardMessages.error.load,
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, filterKK, toast]);

  // Fetch unique KK numbers for filter dropdown (separate query)
  const [uniqueKKNumbers, setUniqueKKNumbers] = useState<string[]>([]);
  const fetchUniqueKK = useCallback(async () => {
    const { data } = await supabase
      .from('anggota')
      .select('no_kk');
    if (data) {
      const unique = [...new Set(data.map(a => a.no_kk))].sort();
      setUniqueKKNumbers(unique);
    }
  }, []);

  // Fetch count of anggota tanpa status
  const [anggotaTanpaStatus, setAnggotaTanpaStatus] = useState(0);
  const fetchAnggotaTanpaStatus = useCallback(async () => {
    const { count } = await supabase
      .from('anggota')
      .select('*', { count: 'exact', head: true })
      .is('status', null);
    setAnggotaTanpaStatus(count || 0);
  }, []);

  useEffect(() => {
    fetchAnggota();
  }, [fetchAnggota]);

  useEffect(() => {
    fetchUniqueKK();
    fetchAnggotaTanpaStatus();
  }, [fetchUniqueKK, fetchAnggotaTanpaStatus]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterKK]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page
  };

  // Refresh data after mutations
  const refreshData = () => {
    fetchAnggota();
    fetchUniqueKK();
    fetchAnggotaTanpaStatus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = anggotaSchema.safeParse(formData);
    if (!validation.success) {
      toast({
        variant: 'destructive',
        title: 'Data Belum Lengkap',
        description: validation.error.errors[0].message,
      });
      return;
    }

    setSubmitting(true);
    try {
      const dataToSave = {
        ...formData,
        avatar_url: avatarUrl,
      };

      if (selectedAnggota) {
        const { error } = await supabase
          .from('anggota')
          .update(dataToSave)
          .eq('id', selectedAnggota.id);
        if (error) throw error;
        toast({ 
          title: '✓ Data Diperbarui', 
          description: StandardMessages.success.anggota.update,
        });
      } else {
        const { error } = await supabase.from('anggota').insert([dataToSave as any]);
        if (error) throw error;
        toast({ 
          title: '✓ Anggota Ditambahkan', 
          description: StandardMessages.success.anggota.add,
        });
      }
      setDialogOpen(false);
      resetForm();
      refreshData();
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

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnggota) return;

    if (!accountData.email || !accountData.password) {
      toast({
        variant: 'destructive',
        title: 'Data Belum Lengkap',
        description: StandardMessages.validation.required,
      });
      return;
    }

    if (accountData.password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Password Tidak Valid',
        description: StandardMessages.validation.password,
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-anggota-account', {
        body: {
          email: accountData.email,
          password: accountData.password,
          anggota_id: selectedAnggota.id,
          nama_lengkap: selectedAnggota.nama_lengkap,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ 
        title: '✓ Akun Berhasil Dibuat', 
        description: StandardMessages.success.anggota.createAccount,
      });
      setAccountDialogOpen(false);
      setAccountData({ email: '', password: '' });
      refreshData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Membuat Akun',
        description: getErrorMessage(error, 'Gagal membuat akun, silakan coba lagi.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAnggota) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('anggota')
        .delete()
        .eq('id', selectedAnggota.id);

      if (error) throw error;
      toast({ 
        title: '✓ Anggota Dihapus', 
        description: StandardMessages.success.anggota.delete,
      });
      setDeleteDialogOpen(false);
      setSelectedAnggota(null);
      refreshData();
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

  const resetForm = () => {
    setFormData(emptyFormData);
    setAvatarUrl(null);
    setSelectedAnggota(null);
    validation.resetValidation();
  };

  const openEditDialog = (anggota: Anggota) => {
    setSelectedAnggota(anggota);
    setAvatarUrl(anggota.avatar_url || null);
    setFormData({
      nama_lengkap: anggota.nama_lengkap,
      nik: anggota.nik,
      no_kk: anggota.no_kk,
      jenis_kelamin: anggota.jenis_kelamin || '',
      tempat_lahir: anggota.tempat_lahir || '',
      tanggal_lahir: anggota.tanggal_lahir || '',
      agama: anggota.agama || '',
      status_perkawinan: anggota.status_perkawinan || '',
      pekerjaan: anggota.pekerjaan || '',
      hubungan_kk: anggota.hubungan_kk || '',
      alamat: anggota.alamat,
      rt: anggota.rt || '',
      rw: anggota.rw || '',
      kelurahan: anggota.kelurahan || '',
      kecamatan: anggota.kecamatan || '',
      kabupaten_kota: anggota.kabupaten_kota || '',
      provinsi: anggota.provinsi || '',
      no_hp: anggota.no_hp,
      status: anggota.status || 'aktif',
    });
    setDialogOpen(true);
  };

  const openAccountDialog = (anggota: Anggota) => {
    setSelectedAnggota(anggota);
    setAccountDialogOpen(true);
  };

  const openDeleteDialog = (anggota: Anggota) => {
    setSelectedAnggota(anggota);
    setDeleteDialogOpen(true);
  };

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / pageSize);

  // Full columns for Excel export
  const exportColumnsExcel = [
    { key: 'nama_lengkap', header: 'Nama Lengkap' },
    { key: 'nik', header: 'NIK' },
    { key: 'no_kk', header: 'No. KK' },
    { key: 'jenis_kelamin', header: 'Jenis Kelamin', format: (v: string) => v === 'L' ? 'Laki-laki' : v === 'P' ? 'Perempuan' : '-' },
    { key: 'tempat_lahir', header: 'Tempat Lahir' },
    { key: 'tanggal_lahir', header: 'Tanggal Lahir' },
    { key: 'agama', header: 'Agama' },
    { key: 'status_perkawinan', header: 'Status Perkawinan' },
    { key: 'pekerjaan', header: 'Pekerjaan' },
    { key: 'hubungan_kk', header: 'Status Dalam KK' },
    { key: 'alamat', header: 'Alamat' },
    { key: 'rt', header: 'RT' },
    { key: 'rw', header: 'RW' },
    { key: 'kelurahan', header: 'Kelurahan' },
    { key: 'kecamatan', header: 'Kecamatan' },
    { key: 'kabupaten_kota', header: 'Kab/Kota' },
    { key: 'provinsi', header: 'Provinsi' },
    { key: 'no_hp', header: 'No. HP' },
    { key: 'status', header: 'Status' },
  ];

  // Simplified columns for PDF (better layout)
  const exportColumnsPDF = [
    { key: 'no', header: 'No' },
    { key: 'nama_lengkap', header: 'Nama Lengkap' },
    { key: 'nik', header: 'NIK' },
    { key: 'no_kk', header: 'No. KK' },
    { key: 'jenis_kelamin', header: 'L/P', format: (v: string) => v || '-' },
    { key: 'hubungan_kk', header: 'Hubungan KK' },
    { key: 'alamat', header: 'Alamat' },
    { key: 'no_hp', header: 'No. HP' },
    { key: 'status', header: 'Status' },
  ];

  // Export state
  const [exporting, setExporting] = useState(false);

  // Fetch all data for export (without pagination limit)
  const fetchAllAnggotaForExport = async (): Promise<Anggota[]> => {
    const { data, error } = await supabase
      .from('anggota')
      .select('*')
      .order('nama_lengkap');
    
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal Mengambil Data',
        description: 'Tidak dapat mengambil semua data untuk export.',
      });
      return [];
    }
    return data as Anggota[];
  };

  const handleExportPDF = () => {
    // Export current page data
    const dataWithNo = anggotaList.map((item, idx) => ({ ...item, no: (currentPage - 1) * pageSize + idx + 1 }));
    exportToPDF(dataWithNo, exportColumnsPDF, 'Data Anggota RUKEM (Halaman ' + currentPage + ')', 'data-anggota', {
      orientation: 'landscape',
    });
  };

  const handleExportExcel = () => {
    // Export current page data
    exportToExcel(anggotaList, exportColumnsExcel, 'Anggota', 'data-anggota-halaman-' + currentPage);
  };

  const handleExportAllPDF = async () => {
    setExporting(true);
    try {
      const allData = await fetchAllAnggotaForExport();
      if (allData.length === 0) return;
      
      const dataWithNo = allData.map((item, idx) => ({ ...item, no: idx + 1 }));
      exportToPDF(dataWithNo, exportColumnsPDF, 'Data Anggota RUKEM (Semua Data)', 'data-anggota-lengkap', {
        orientation: 'landscape',
      });
      toast({
        title: '✓ Export Berhasil',
        description: `${allData.length.toLocaleString('id-ID')} data anggota berhasil diexport ke PDF.`,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportAllExcel = async () => {
    setExporting(true);
    try {
      const allData = await fetchAllAnggotaForExport();
      if (allData.length === 0) return;
      
      exportToExcel(allData, exportColumnsExcel, 'Anggota', 'data-anggota-lengkap');
      toast({
        title: '✓ Export Berhasil',
        description: `${allData.length.toLocaleString('id-ID')} data anggota berhasil diexport ke Excel.`,
      });
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      key: 'nama_lengkap',
      header: 'Nama',
      cell: (item: Anggota) => (
        <div>
          <p className="font-medium">{item.nama_lengkap}</p>
          <p className="text-xs text-muted-foreground">{item.hubungan_kk || '-'}</p>
        </div>
      ),
    },
    {
      key: 'nik',
      header: 'NIK',
      className: 'hidden md:table-cell',
    },
    {
      key: 'no_kk',
      header: 'No. KK',
      className: 'hidden lg:table-cell',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: Anggota) => <StatusBadge status={item.status} />,
    },
    {
      key: 'user_id',
      header: 'Akun',
      cell: (item: Anggota) => (
        item.user_id ? (
          <span className="text-xs text-success">Sudah ada</span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openAccountDialog(item);
            }}
          >
            <KeyRound className="h-3 w-3 mr-1" />
            Buat Akun
          </Button>
        )
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (item: Anggota) => (
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
      <PageHeader title="Manajemen Anggota" description="Kelola data anggota RUKEM">
        <div className="flex flex-wrap gap-2">
          <ExportButtons
            onExportPDF={handleExportPDF}
            onExportExcel={handleExportExcel}
            onExportAllPDF={handleExportAllPDF}
            onExportAllExcel={handleExportAllExcel}
            disabled={anggotaList.length === 0 && totalCount === 0}
            loading={exporting}
          />
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          {anggotaTanpaStatus > 0 && (
            <Button variant="outline" onClick={() => setFixStatusDialogOpen(true)} className="border-warning text-warning hover:bg-warning/10">
              <Wrench className="h-4 w-4 mr-2" />
              Perbaiki Data ({anggotaTanpaStatus})
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Anggota
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedAnggota ? 'Edit Anggota' : 'Tambah Anggota Baru'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Data Pribadi */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-primary border-b pb-2">DATA PRIBADI</h3>
                
                {/* Avatar Upload */}
                <div className="flex justify-center py-2">
                  <AvatarUpload
                    value={avatarUrl}
                    onChange={setAvatarUrl}
                    name={formData.nama_lengkap}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nama_lengkap" className={cn(validation.getFieldError('nama_lengkap') && "text-destructive")}>
                    Nama Lengkap <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="nama_lengkap"
                      value={formData.nama_lengkap}
                      onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                      onBlur={() => { validation.markTouched('nama_lengkap'); validation.validateField('nama_lengkap'); }}
                      placeholder="Sesuai KTP"
                      className={cn(
                        "pr-10 transition-colors",
                        validation.getFieldError('nama_lengkap') && "border-destructive focus-visible:ring-destructive/30",
                        validation.isFieldValid('nama_lengkap') && "border-success focus-visible:ring-success/30"
                      )}
                    />
                    {(validation.getFieldError('nama_lengkap') || validation.isFieldValid('nama_lengkap')) && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {validation.getFieldError('nama_lengkap') ? (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        )}
                      </div>
                    )}
                  </div>
                  {validation.getFieldError('nama_lengkap') && (
                    <p className="text-xs text-destructive animate-in slide-in-from-top-1 fade-in duration-200">
                      {validation.getFieldError('nama_lengkap')}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nik" className={cn(validation.getFieldError('nik') && "text-destructive")}>
                      NIK <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="nik"
                        value={formData.nik}
                        onChange={(e) => setFormData({ ...formData, nik: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                        onBlur={() => { validation.markTouched('nik'); validation.validateField('nik'); }}
                        maxLength={16}
                        placeholder="16 digit"
                        className={cn(
                          "pr-10 transition-colors",
                          validation.getFieldError('nik') && "border-destructive focus-visible:ring-destructive/30",
                          validation.isFieldValid('nik') && "border-success focus-visible:ring-success/30"
                        )}
                      />
                      {(validation.getFieldError('nik') || validation.isFieldValid('nik')) && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {validation.getFieldError('nik') ? (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          )}
                        </div>
                      )}
                    </div>
                    {validation.getFieldError('nik') && (
                      <p className="text-xs text-destructive animate-in slide-in-from-top-1 fade-in duration-200">
                        {validation.getFieldError('nik')}
                      </p>
                    )}
                    {!validation.getFieldError('nik') && formData.nik.length > 0 && formData.nik.length < 16 && (
                      <p className="text-xs text-muted-foreground">{formData.nik.length}/16 digit</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="no_kk" className={cn(validation.getFieldError('no_kk') && "text-destructive")}>
                      Nomor KK <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="no_kk"
                        value={formData.no_kk}
                        onChange={(e) => setFormData({ ...formData, no_kk: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                        onBlur={() => { validation.markTouched('no_kk'); validation.validateField('no_kk'); }}
                        maxLength={16}
                        placeholder="16 digit"
                        className={cn(
                          "pr-10 transition-colors",
                          validation.getFieldError('no_kk') && "border-destructive focus-visible:ring-destructive/30",
                          validation.isFieldValid('no_kk') && "border-success focus-visible:ring-success/30"
                        )}
                      />
                      {(validation.getFieldError('no_kk') || validation.isFieldValid('no_kk')) && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {validation.getFieldError('no_kk') ? (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          )}
                        </div>
                      )}
                    </div>
                    {validation.getFieldError('no_kk') && (
                      <p className="text-xs text-destructive animate-in slide-in-from-top-1 fade-in duration-200">
                        {validation.getFieldError('no_kk')}
                      </p>
                    )}
                    {!validation.getFieldError('no_kk') && formData.no_kk.length > 0 && formData.no_kk.length < 16 && (
                      <p className="text-xs text-muted-foreground">{formData.no_kk.length}/16 digit</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="jenis_kelamin">Jenis Kelamin *</Label>
                    <Select
                      value={formData.jenis_kelamin}
                      onValueChange={(value) => setFormData({ ...formData, jenis_kelamin: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hubungan_kk">Status Dalam KK *</Label>
                    <Select
                      value={formData.hubungan_kk}
                      onValueChange={(value) => setFormData({ ...formData, hubungan_kk: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        {HUBUNGAN_KK_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tempat_lahir">Tempat Lahir *</Label>
                    <Input
                      id="tempat_lahir"
                      value={formData.tempat_lahir}
                      onChange={(e) => setFormData({ ...formData, tempat_lahir: e.target.value })}
                      placeholder="Kota/Kabupaten"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tanggal_lahir">Tanggal Lahir *</Label>
                    <Input
                      id="tanggal_lahir"
                      type="date"
                      value={formData.tanggal_lahir}
                      onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agama">Agama *</Label>
                    <Select
                      value={formData.agama}
                      onValueChange={(value) => setFormData({ ...formData, agama: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        {AGAMA_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status_perkawinan">Status Perkawinan *</Label>
                    <Select
                      value={formData.status_perkawinan}
                      onValueChange={(value) => setFormData({ ...formData, status_perkawinan: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_PERKAWINAN_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pekerjaan">Pekerjaan *</Label>
                  <Input
                    id="pekerjaan"
                    value={formData.pekerjaan}
                    onChange={(e) => setFormData({ ...formData, pekerjaan: e.target.value })}
                    placeholder="Misal: Wiraswasta, PNS, Petani, dll"
                    required
                  />
                </div>
              </div>

              {/* Data Alamat */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-primary border-b pb-2">DATA ALAMAT</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="alamat">Alamat Lengkap *</Label>
                  <Textarea
                    id="alamat"
                    value={formData.alamat}
                    onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                    placeholder="Nama jalan, nomor rumah, gang, dll"
                    required
                  />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rt">RT *</Label>
                    <Input
                      id="rt"
                      value={formData.rt}
                      onChange={(e) => setFormData({ ...formData, rt: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                      maxLength={3}
                      placeholder="001"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rw">RW *</Label>
                    <Input
                      id="rw"
                      value={formData.rw}
                      onChange={(e) => setFormData({ ...formData, rw: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                      maxLength={3}
                      placeholder="001"
                      required
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="kelurahan">Kelurahan/Desa *</Label>
                    <Input
                      id="kelurahan"
                      value={formData.kelurahan}
                      onChange={(e) => setFormData({ ...formData, kelurahan: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="kecamatan">Kecamatan *</Label>
                    <Input
                      id="kecamatan"
                      value={formData.kecamatan}
                      onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kabupaten_kota">Kabupaten/Kota *</Label>
                    <Input
                      id="kabupaten_kota"
                      value={formData.kabupaten_kota}
                      onChange={(e) => setFormData({ ...formData, kabupaten_kota: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provinsi">Provinsi *</Label>
                    <Input
                      id="provinsi"
                      value={formData.provinsi}
                      onChange={(e) => setFormData({ ...formData, provinsi: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Kontak */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-primary border-b pb-2">KONTAK</h3>
                <div className="space-y-2">
                  <Label htmlFor="no_hp">No. HP *</Label>
                  <Input
                    id="no_hp"
                    value={formData.no_hp}
                    onChange={(e) => setFormData({ ...formData, no_hp: e.target.value.replace(/\D/g, '') })}
                    placeholder="08xxxxxxxxxx"
                    required
                  />
                </div>
              </div>

              {/* Status Keanggotaan */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-primary border-b pb-2">STATUS KEANGGOTAAN</h3>
                <div className="space-y-2">
                  <Label htmlFor="status">Status Anggota *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'aktif' | 'nonaktif' | 'meninggal') => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Pilih Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {STATUS_ANGGOTA_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Status ini menentukan apakah anggota termasuk dalam perhitungan anggota aktif.
                  </p>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Menyimpan...' : selectedAnggota ? 'Simpan Perubahan' : 'Tambah Anggota'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </PageHeader>

      {/* Import Dialog */}
      <ImportAnggotaDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={refreshData}
      />

      {/* Fix Status Dialog */}
      <FixStatusAnggotaDialog
        open={fixStatusDialogOpen}
        onOpenChange={setFixStatusDialogOpen}
        onSuccess={refreshData}
        anggotaTanpaStatus={anggotaTanpaStatus}
      />

      {/* Create Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Akun Login</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Buat akun login untuk: <strong>{selectedAnggota?.nama_lengkap}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={accountData.email}
                onChange={(e) => setAccountData({ ...accountData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={accountData.password}
                onChange={(e) => setAccountData({ ...accountData, password: e.target.value })}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">Minimal 6 karakter</p>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Membuat Akun...' : 'Buat Akun'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Hapus Anggota?"
        description={`Anggota "${selectedAnggota?.nama_lengkap}" akan dihapus. Data yang terkait seperti iuran juga akan terpengaruh.`}
        loading={submitting}
      />

      <div className="mt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, NIK, No KK, atau No HP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterKK} onValueChange={setFilterKK}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter No. KK" />
              </SelectTrigger>
              <SelectContent>
                {uniqueKKNumbers.map((kk) => (
                  <SelectItem key={kk} value={kk}>{kk}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filterKK && (
              <Button variant="ghost" size="icon" onClick={() => setFilterKK('')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {filterKK && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Menampilkan data dengan No. KK: <span className="font-medium text-foreground">{filterKK}</span>
            </p>
          </div>
        )}

        {loading ? (
          <AdminAnggotaSkeleton />
        ) : anggotaList.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum ada anggota"
            description={search || filterKK ? "Tidak ada data yang sesuai dengan filter" : "Tambahkan anggota baru untuk memulai"}
          />
        ) : (
          <>
            <DataTable data={anggotaList} columns={columns} />
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              loading={loading}
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}