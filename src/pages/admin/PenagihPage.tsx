import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { AdminDashboardSkeleton } from '@/components/ui/admin-loading-skeleton';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Users, MapPin, Trash2, Edit, UserCheck, Eye, EyeOff } from 'lucide-react';
import type { PenagihWilayah } from '@/types/database';
import { getErrorMessage, StandardMessages } from '@/lib/error-messages';

interface PenagihData {
  id: string;
  user_id: string;
  nama_lengkap: string;
  email: string | null;
  status_aktif: boolean;
  created_at: string;
}

interface PenagihWithWilayah extends PenagihData {
  wilayah: PenagihWilayah[];
}

interface WilayahOption {
  rt: string;
  rw: string;
}

export default function PenagihPage() {
  const [penagihList, setPenagihList] = useState<PenagihWithWilayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wilayahDialogOpen, setWilayahDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePenagihDialogOpen, setDeletePenagihDialogOpen] = useState(false);
  const [selectedPenagih, setSelectedPenagih] = useState<PenagihWithWilayah | null>(null);
  const [selectedWilayah, setSelectedWilayah] = useState<PenagihWilayah | null>(null);
  const [penagihToDelete, setPenagihToDelete] = useState<PenagihWithWilayah | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Available RT/RW options from anggota data
  const [availableRT, setAvailableRT] = useState<string[]>([]);
  const [availableRW, setAvailableRW] = useState<string[]>([]);
  const [wilayahOptions, setWilayahOptions] = useState<WilayahOption[]>([]);
  
  const [formData, setFormData] = useState({
    nama_lengkap: '',
    email: '',
    password: '',
    rt: '',
    rw: '',
  });
  const [wilayahFormData, setWilayahFormData] = useState({
    rt: '',
    rw: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    fetchWilayahOptions();
  }, []);

  const fetchWilayahOptions = async () => {
    try {
      // Get distinct RT/RW from anggota table
      const { data, error } = await supabase
        .from('anggota')
        .select('rt, rw')
        .not('rt', 'is', null)
        .not('rw', 'is', null);

      if (error) {
        console.error('Error fetching wilayah options:', error);
        return;
      }

      if (data) {
        // Get unique RT values
        const uniqueRT = [...new Set(data.map(d => d.rt).filter(Boolean))].sort();
        // Get unique RW values
        const uniqueRW = [...new Set(data.map(d => d.rw).filter(Boolean))].sort();
        // Get unique RT/RW combinations
        const uniqueWilayah: WilayahOption[] = [];
        const seen = new Set<string>();
        data.forEach(d => {
          if (d.rt && d.rw) {
            const key = `${d.rt}-${d.rw}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueWilayah.push({ rt: d.rt, rw: d.rw });
            }
          }
        });

        setAvailableRT(uniqueRT);
        setAvailableRW(uniqueRW);
        setWilayahOptions(uniqueWilayah.sort((a, b) => {
          if (a.rw !== b.rw) return a.rw.localeCompare(b.rw);
          return a.rt.localeCompare(b.rt);
        }));
      }
    } catch (error) {
      console.error('Error fetching wilayah:', error);
    }
  };

  const fetchData = async () => {
    try {
      // Fetch penagih data from penagih table
      const { data: penagihData, error: penagihError } = await supabase
        .from('penagih')
        .select('*')
        .order('created_at', { ascending: false });

      if (penagihError) {
        console.error('Error fetching penagih:', penagihError);
        await fetchDataLegacy();
        return;
      }

      // Fetch wilayah for each penagih
      const { data: wilayahData } = await supabase
        .from('penagih_wilayah')
        .select('*');

      // Combine data
      const penagihWithWilayah: PenagihWithWilayah[] = (penagihData || []).map(p => {
        const userWilayah = wilayahData?.filter(w => w.penagih_user_id === p.user_id) || [];
        return {
          ...p,
          wilayah: userWilayah,
        };
      });

      setPenagihList(penagihWithWilayah);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Legacy fetch for backwards compatibility
  const fetchDataLegacy = async () => {
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'penagih');

    const penagihUserIds = rolesData?.map(r => r.user_id) || [];
    
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', penagihUserIds);

    const { data: wilayahData } = await supabase
      .from('penagih_wilayah')
      .select('*');

    const penagihWithWilayah: PenagihWithWilayah[] = penagihUserIds.map(userId => {
      const profile = profilesData?.find(p => p.user_id === userId);
      const userWilayah = wilayahData?.filter(w => w.penagih_user_id === userId) || [];
      
      return {
        id: userId,
        user_id: userId,
        nama_lengkap: profile?.full_name || 'Penagih',
        email: null,
        status_aktif: true,
        created_at: new Date().toISOString(),
        wilayah: userWilayah,
      };
    });

    setPenagihList(penagihWithWilayah);
  };

  const resetForm = () => {
    setFormData({ nama_lengkap: '', email: '', password: '', rt: '', rw: '' });
    setShowPassword(false);
  };

  const openWilayahDialog = (penagih: PenagihWithWilayah, wilayah?: PenagihWilayah) => {
    setSelectedPenagih(penagih);
    setSelectedWilayah(wilayah || null);
    setWilayahFormData({
      rt: wilayah?.rt || '',
      rw: wilayah?.rw || '',
    });
    setWilayahDialogOpen(true);
  };

  const openDeleteDialog = (penagih: PenagihWithWilayah, wilayah: PenagihWilayah) => {
    setSelectedPenagih(penagih);
    setSelectedWilayah(wilayah);
    setDeleteDialogOpen(true);
  };

  const handleToggleStatus = async (penagih: PenagihWithWilayah) => {
    try {
      const newStatus = !penagih.status_aktif;
      
      const { error } = await supabase
        .from('penagih')
        .update({ status_aktif: newStatus })
        .eq('id', penagih.id);

      if (error) throw error;

      toast({
        title: newStatus ? '✓ Penagih Diaktifkan' : '✓ Penagih Dinonaktifkan',
        description: `Status ${penagih.nama_lengkap} berhasil diubah.`,
      });

      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Mengubah Status',
        description: getErrorMessage(error, 'Terjadi kesalahan'),
      });
    }
  };

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Get user-friendly error message
  const getSpecificErrorMessage = (error: any): string => {
    const message = error?.message?.toLowerCase() || '';
    
    if (message.includes('email') && message.includes('already')) {
      return 'Email sudah digunakan oleh akun lain. Gunakan email yang berbeda.';
    }
    if (message.includes('duplicate') && message.includes('email')) {
      return 'Email sudah terdaftar. Silakan gunakan email lain.';
    }
    if (message.includes('password') && message.includes('weak')) {
      return 'Password terlalu lemah. Gunakan kombinasi huruf dan angka.';
    }
    if (message.includes('invalid') && message.includes('email')) {
      return 'Format email tidak valid. Periksa kembali alamat email.';
    }
    if (message.includes('network') || message.includes('fetch')) {
      return 'Koneksi bermasalah. Periksa koneksi internet Anda.';
    }
    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return 'Anda tidak memiliki izin untuk membuat akun penagih.';
    }
    
    return error?.message || 'Terjadi kesalahan saat membuat akun. Silakan coba lagi.';
  };

  const handleAddPenagih = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation with specific error messages
    if (!formData.nama_lengkap.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nama Belum Diisi',
        description: 'Masukkan nama lengkap penagih.',
      });
      return;
    }

    if (!formData.email.trim()) {
      toast({
        variant: 'destructive',
        title: 'Email Belum Diisi',
        description: 'Masukkan alamat email untuk akun penagih.',
      });
      return;
    }

    if (!isValidEmail(formData.email)) {
      toast({
        variant: 'destructive',
        title: 'Format Email Tidak Valid',
        description: 'Masukkan alamat email yang benar (contoh: penagih@email.com).',
      });
      return;
    }

    if (!formData.password) {
      toast({
        variant: 'destructive',
        title: 'Password Belum Diisi',
        description: 'Masukkan password untuk akun penagih.',
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Password Terlalu Pendek',
        description: 'Password minimal 8 karakter.',
      });
      return;
    }

    if (!formData.rt) {
      toast({
        variant: 'destructive',
        title: 'Wilayah RT Belum Dipilih',
        description: 'Pilih RT dari dropdown yang tersedia.',
      });
      return;
    }

    if (!formData.rw) {
      toast({
        variant: 'destructive',
        title: 'Wilayah RW Belum Dipilih',
        description: 'Pilih RW dari dropdown yang tersedia.',
      });
      return;
    }

    // Check if RT/RW combination exists in anggota data
    const wilayahExists = wilayahOptions.some(w => w.rt === formData.rt && w.rw === formData.rw);
    if (!wilayahExists) {
      toast({
        variant: 'destructive',
        title: 'Wilayah Tidak Valid',
        description: `Kombinasi RT ${formData.rt} / RW ${formData.rw} tidak ditemukan dalam data anggota. Pastikan ada anggota yang terdaftar di wilayah tersebut.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('Sesi tidak valid. Silakan login ulang.');
      }

      const response = await supabase.functions.invoke('create-penagih-account', {
        body: {
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          nama_lengkap: formData.nama_lengkap.trim(),
          rt: formData.rt,
          rw: formData.rw,
        },
      });

      if (response.error) {
        throw new Error(getSpecificErrorMessage(response.error));
      }

      if (response.data?.error) {
        throw new Error(getSpecificErrorMessage({ message: response.data.error }));
      }

      toast({
        title: '✓ Penagih Berhasil Dibuat',
        description: `Akun penagih ${formData.nama_lengkap} untuk wilayah RT ${formData.rt}/RW ${formData.rw} berhasil dibuat.`,
      });
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Membuat Akun Penagih',
        description: getSpecificErrorMessage(error),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveWilayah = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPenagih) {
      toast({
        variant: 'destructive',
        title: 'Kesalahan',
        description: 'Penagih tidak dipilih.',
      });
      return;
    }

    if (!wilayahFormData.rt) {
      toast({
        variant: 'destructive',
        title: 'Wilayah RT Belum Dipilih',
        description: 'Pilih RT dari dropdown yang tersedia.',
      });
      return;
    }

    if (!wilayahFormData.rw) {
      toast({
        variant: 'destructive',
        title: 'Wilayah RW Belum Dipilih',
        description: 'Pilih RW dari dropdown yang tersedia.',
      });
      return;
    }

    // Check if this wilayah is already assigned to this penagih
    const alreadyAssigned = selectedPenagih.wilayah.some(
      w => w.rt === wilayahFormData.rt && w.rw === wilayahFormData.rw && w.id !== selectedWilayah?.id
    );
    if (alreadyAssigned) {
      toast({
        variant: 'destructive',
        title: 'Wilayah Sudah Ditambahkan',
        description: `Penagih ini sudah memiliki wilayah RT ${wilayahFormData.rt}/RW ${wilayahFormData.rw}.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      if (selectedWilayah) {
        const { error } = await supabase
          .from('penagih_wilayah')
          .update({
            rt: wilayahFormData.rt,
            rw: wilayahFormData.rw,
          })
          .eq('id', selectedWilayah.id);

        if (error) throw error;
        toast({ 
          title: '✓ Wilayah Diperbarui', 
          description: `Wilayah berhasil diubah menjadi RT ${wilayahFormData.rt}/RW ${wilayahFormData.rw}.` 
        });
      } else {
        const { error } = await supabase
          .from('penagih_wilayah')
          .insert({
            penagih_user_id: selectedPenagih.user_id,
            rt: wilayahFormData.rt,
            rw: wilayahFormData.rw,
          });

        if (error) throw error;
        toast({ 
          title: '✓ Wilayah Ditambahkan', 
          description: `Wilayah RT ${wilayahFormData.rt}/RW ${wilayahFormData.rw} berhasil ditambahkan.` 
        });
      }

      setWilayahDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Menyimpan Wilayah',
        description: getErrorMessage(error, StandardMessages.error.save),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWilayah = async () => {
    if (!selectedWilayah) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('penagih_wilayah')
        .delete()
        .eq('id', selectedWilayah.id);

      if (error) throw error;

      toast({ 
        title: '✓ Wilayah Dihapus', 
        description: `Wilayah RT ${selectedWilayah.rt}/RW ${selectedWilayah.rw} berhasil dihapus.` 
      });
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Menghapus Wilayah',
        description: getErrorMessage(error, StandardMessages.error.delete),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openDeletePenagihDialog = (penagih: PenagihWithWilayah) => {
    setPenagihToDelete(penagih);
    setDeletePenagihDialogOpen(true);
  };

  const handleDeletePenagih = async () => {
    if (!penagihToDelete) return;

    setSubmitting(true);
    try {
      const response = await supabase.functions.invoke('delete-penagih-account', {
        body: {
          penagih_user_id: penagihToDelete.user_id,
          penagih_id: penagihToDelete.id,
        },
      });

      if (response.error) {
        // Handle specific error messages from edge function
        const errorMsg = response.error.message || 'Gagal menghapus penagih';
        throw new Error(errorMsg);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({ 
        title: '✓ Akun Penagih Berhasil Dihapus', 
        description: response.data?.message || `Akun ${penagihToDelete.nama_lengkap} telah dihapus permanen dan tidak dapat login kembali.` 
      });
      setDeletePenagihDialogOpen(false);
      setPenagihToDelete(null);
      
      // Refresh data immediately to remove deleted penagih from list
      await fetchData();
    } catch (error: any) {
      // Show specific error message from backend
      const errorMessage = error.message || 'Terjadi kesalahan saat menghapus penagih';
      
      toast({
        variant: 'destructive',
        title: 'Gagal Menghapus Penagih',
        description: errorMessage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPenagih = penagihList.filter((p) =>
    p.nama_lengkap?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase()) ||
    p.wilayah.some(w => w.rt.includes(search) || w.rw.includes(search))
  );

  // Filter RW options based on selected RT (for form)
  const getFilteredRW = (selectedRT: string) => {
    if (!selectedRT) return availableRW;
    const rwForRT = wilayahOptions
      .filter(w => w.rt === selectedRT)
      .map(w => w.rw);
    return [...new Set(rwForRT)].sort();
  };

  // Filter RT options based on selected RW (for form)
  const getFilteredRT = (selectedRW: string) => {
    if (!selectedRW) return availableRT;
    const rtForRW = wilayahOptions
      .filter(w => w.rw === selectedRW)
      .map(w => w.rt);
    return [...new Set(rtForRW)].sort();
  };

  const columns = [
    {
      key: 'name',
      header: 'Nama Penagih',
      cell: (item: PenagihWithWilayah) => (
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${item.status_aktif ? 'bg-primary/10' : 'bg-muted'}`}>
            <UserCheck className={`h-5 w-5 ${item.status_aktif ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className="font-medium">{item.nama_lengkap}</p>
            <p className="text-xs text-muted-foreground">{item.email || 'Email tidak tersedia'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'wilayah',
      header: 'Wilayah (RT/RW)',
      cell: (item: PenagihWithWilayah) => (
        <div className="flex flex-wrap gap-1">
          {item.wilayah.map((w) => (
            <Badge key={w.id} variant="outline" className="text-xs">
              RT {w.rt}/RW {w.rw}
            </Badge>
          ))}
          {item.wilayah.length === 0 && (
            <span className="text-muted-foreground text-sm">Belum ada wilayah</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: PenagihWithWilayah) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={item.status_aktif}
            onCheckedChange={() => handleToggleStatus(item)}
          />
          <Badge variant={item.status_aktif ? 'default' : 'secondary'}>
            {item.status_aktif ? 'Aktif' : 'Nonaktif'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (item: PenagihWithWilayah) => (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openWilayahDialog(item)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Wilayah
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => openDeletePenagihDialog(item)}
            title="Hapus Penagih"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <PageHeader title="Kelola Penagih" description="Kelola penagih dan wilayah tugasnya" />
        <AdminDashboardSkeleton />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <PageHeader title="Kelola Penagih" description="Kelola penagih dan wilayah tugasnya">
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Penagih
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Tambah Penagih Baru</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddPenagih} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nama Lengkap <span className="text-destructive">*</span></Label>
                <Input
                  value={formData.nama_lengkap}
                  onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                  placeholder="Masukkan nama lengkap"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="penagih@email.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Password <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimal 8 karakter"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Minimal 8 karakter</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>RT <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.rt}
                    onValueChange={(value) => setFormData({ ...formData, rt: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih RT" />
                    </SelectTrigger>
                    <SelectContent>
                      {(formData.rw ? getFilteredRT(formData.rw) : availableRT).map((rt) => (
                        <SelectItem key={rt} value={rt}>
                          RT {rt}
                        </SelectItem>
                      ))}
                      {availableRT.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Tidak ada data RT
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>RW <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.rw}
                    onValueChange={(value) => setFormData({ ...formData, rw: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih RW" />
                    </SelectTrigger>
                    <SelectContent>
                      {(formData.rt ? getFilteredRW(formData.rt) : availableRW).map((rw) => (
                        <SelectItem key={rw} value={rw}>
                          RW {rw}
                        </SelectItem>
                      ))}
                      {availableRW.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Tidak ada data RW
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {availableRT.length === 0 && (
                <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                  Belum ada data anggota dengan RT/RW. Tambahkan anggota terlebih dahulu.
                </p>
              )}

              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                Akun penagih akan dibuat dengan role "Penagih" dan dapat langsung login. Penagih hanya dapat melihat data KK dan tagihan di wilayah RT/RW yang ditentukan.
              </p>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={submitting || availableRT.length === 0}>
                  {submitting ? 'Membuat Akun...' : 'Buat Akun Penagih'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mt-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, email, atau wilayah..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {filteredPenagih.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum Ada Penagih"
            description="Klik tombol 'Tambah Penagih' untuk membuat akun penagih baru."
          />
        ) : (
          <>
            <DataTable columns={columns} data={filteredPenagih} />

            {/* Detail Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPenagih.map((penagih) => (
                <Card key={penagih.id} className={!penagih.status_aktif ? 'opacity-60' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <UserCheck className={`h-4 w-4 ${penagih.status_aktif ? 'text-primary' : 'text-muted-foreground'}`} />
                        {penagih.nama_lengkap}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={penagih.status_aktif}
                          onCheckedChange={() => handleToggleStatus(penagih)}
                        />
                      </div>
                    </div>
                    {penagih.email && (
                      <p className="text-xs text-muted-foreground">{penagih.email}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Status:</p>
                        <Badge variant={penagih.status_aktif ? 'default' : 'secondary'}>
                          {penagih.status_aktif ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Wilayah Tugas:</p>
                      {penagih.wilayah.map((w) => (
                        <div key={w.id} className="flex items-center justify-between bg-muted/50 p-2 rounded-lg">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">RT {w.rt} / RW {w.rw}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openWilayahDialog(penagih, w)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openDeleteDialog(penagih, w)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {penagih.wilayah.length === 0 && (
                        <p className="text-sm text-muted-foreground italic">Belum ada wilayah</p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => openWilayahDialog(penagih)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Tambah Wilayah
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Wilayah Dialog */}
      <Dialog open={wilayahDialogOpen} onOpenChange={setWilayahDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedWilayah ? 'Edit Wilayah' : 'Tambah Wilayah'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveWilayah} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Penagih: <strong>{selectedPenagih?.nama_lengkap || 'Penagih'}</strong>
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>RT <span className="text-destructive">*</span></Label>
                <Select
                  value={wilayahFormData.rt}
                  onValueChange={(value) => setWilayahFormData({ ...wilayahFormData, rt: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih RT" />
                  </SelectTrigger>
                  <SelectContent>
                    {(wilayahFormData.rw ? getFilteredRT(wilayahFormData.rw) : availableRT).map((rt) => (
                      <SelectItem key={rt} value={rt}>
                        RT {rt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>RW <span className="text-destructive">*</span></Label>
                <Select
                  value={wilayahFormData.rw}
                  onValueChange={(value) => setWilayahFormData({ ...wilayahFormData, rw: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih RW" />
                  </SelectTrigger>
                  <SelectContent>
                    {(wilayahFormData.rt ? getFilteredRW(wilayahFormData.rt) : availableRW).map((rw) => (
                      <SelectItem key={rw} value={rw}>
                        RW {rw}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              Perubahan wilayah langsung mempengaruhi data KK dan tagihan yang dapat diakses penagih ini.
            </p>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setWilayahDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Wilayah Confirmation */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteWilayah}
        title="Hapus Wilayah"
        description={`Apakah Anda yakin ingin menghapus wilayah RT ${selectedWilayah?.rt}/RW ${selectedWilayah?.rw}? Penagih tidak akan bisa mengakses data di wilayah ini.`}
        loading={submitting}
      />

      {/* Delete Penagih Confirmation */}
      <DeleteConfirmDialog
        open={deletePenagihDialogOpen}
        onOpenChange={setDeletePenagihDialogOpen}
        onConfirm={handleDeletePenagih}
        title="Hapus Akun Penagih Permanen"
        description={`Akun penagih "${penagihToDelete?.nama_lengkap}" akan dihapus PERMANEN dan tidak dapat login kembali. Data transaksi pembayaran yang pernah diinput tetap tersimpan untuk keperluan audit dan laporan. Lanjutkan?`}
        loading={submitting}
      />
    </AdminLayout>
  );
}
