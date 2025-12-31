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
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Users, MapPin, Trash2, Edit, UserCheck, Eye, EyeOff, Power } from 'lucide-react';
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

export default function PenagihPage() {
  const [penagihList, setPenagihList] = useState<PenagihWithWilayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wilayahDialogOpen, setWilayahDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPenagih, setSelectedPenagih] = useState<PenagihWithWilayah | null>(null);
  const [selectedWilayah, setSelectedWilayah] = useState<PenagihWilayah | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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
  }, []);

  const fetchData = async () => {
    try {
      // Fetch penagih data from penagih table
      const { data: penagihData, error: penagihError } = await supabase
        .from('penagih')
        .select('*')
        .order('created_at', { ascending: false });

      if (penagihError) {
        console.error('Error fetching penagih:', penagihError);
        // Fallback to old method if table doesn't exist
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

  const handleAddPenagih = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nama_lengkap || !formData.email || !formData.password || !formData.rt || !formData.rw) {
      toast({
        variant: 'destructive',
        title: 'Data Belum Lengkap',
        description: 'Semua field wajib diisi.',
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Password Terlalu Pendek',
        description: 'Password minimal 6 karakter.',
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
          email: formData.email,
          password: formData.password,
          nama_lengkap: formData.nama_lengkap,
          rt: formData.rt,
          rw: formData.rw,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Gagal membuat akun penagih');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: '✓ Penagih Berhasil Dibuat',
        description: `Akun penagih ${formData.nama_lengkap} berhasil dibuat.`,
      });
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Membuat Akun',
        description: getErrorMessage(error, StandardMessages.error.save),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveWilayah = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPenagih || !wilayahFormData.rt || !wilayahFormData.rw) {
      toast({
        variant: 'destructive',
        title: 'Data Belum Lengkap',
        description: StandardMessages.validation.required,
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
        toast({ title: '✓ Wilayah Diperbarui', description: 'Data wilayah berhasil diperbarui.' });
      } else {
        const { error } = await supabase
          .from('penagih_wilayah')
          .insert({
            penagih_user_id: selectedPenagih.user_id,
            rt: wilayahFormData.rt,
            rw: wilayahFormData.rw,
          });

        if (error) throw error;
        toast({ title: '✓ Wilayah Ditambahkan', description: 'Wilayah baru berhasil ditambahkan.' });
      }

      setWilayahDialogOpen(false);
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

  const handleDeleteWilayah = async () => {
    if (!selectedWilayah) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('penagih_wilayah')
        .delete()
        .eq('id', selectedWilayah.id);

      if (error) throw error;

      toast({ title: '✓ Wilayah Dihapus', description: 'Wilayah berhasil dihapus.' });
      setDeleteDialogOpen(false);
      fetchData();
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

  const filteredPenagih = penagihList.filter((p) =>
    p.nama_lengkap?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase()) ||
    p.wilayah.some(w => w.rt.includes(search) || w.rw.includes(search))
  );

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
                    placeholder="Minimal 6 karakter"
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>RT <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.rt}
                    onChange={(e) => setFormData({ ...formData, rt: e.target.value })}
                    placeholder="001"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>RW <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.rw}
                    onChange={(e) => setFormData({ ...formData, rw: e.target.value })}
                    placeholder="001"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                Akun penagih akan otomatis dibuat dengan role "Penagih" dan dapat langsung login menggunakan email dan password di atas.
              </p>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={submitting}>
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
                <Input
                  value={wilayahFormData.rt}
                  onChange={(e) => setWilayahFormData({ ...wilayahFormData, rt: e.target.value })}
                  placeholder="001"
                />
              </div>
              <div className="space-y-1.5">
                <Label>RW <span className="text-destructive">*</span></Label>
                <Input
                  value={wilayahFormData.rw}
                  onChange={(e) => setWilayahFormData({ ...wilayahFormData, rw: e.target.value })}
                  placeholder="001"
                />
              </div>
            </div>

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

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteWilayah}
        title="Hapus Wilayah"
        description={`Apakah Anda yakin ingin menghapus wilayah RT ${selectedWilayah?.rt}/RW ${selectedWilayah?.rw}?`}
        loading={submitting}
      />
    </AdminLayout>
  );
}
