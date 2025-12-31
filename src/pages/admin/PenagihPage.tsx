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
import { Plus, Search, Users, MapPin, Trash2, Edit, UserCheck } from 'lucide-react';
import type { PenagihWilayah } from '@/types/database';
import { getErrorMessage, StandardMessages } from '@/lib/error-messages';

interface UserWithRole {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface PenagihWithWilayah {
  user_id: string;
  email: string;
  full_name: string | null;
  wilayah: PenagihWilayah[];
}

export default function PenagihPage() {
  const [penagihList, setPenagihList] = useState<PenagihWithWilayah[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [wilayahDialogOpen, setWilayahDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPenagih, setSelectedPenagih] = useState<PenagihWithWilayah | null>(null);
  const [selectedWilayah, setSelectedWilayah] = useState<PenagihWilayah | null>(null);
  const [formData, setFormData] = useState({
    user_id: '',
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
      // Fetch users with penagih role
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'penagih');

      // Get user details from profiles (we can't query auth.users directly)
      const penagihUserIds = rolesData?.map(r => r.user_id) || [];
      
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', penagihUserIds);

      // Fetch wilayah for each penagih
      const { data: wilayahData } = await supabase
        .from('penagih_wilayah')
        .select('*');

      // Combine data
      const penagihWithWilayah: PenagihWithWilayah[] = penagihUserIds.map(userId => {
        const profile = profilesData?.find(p => p.user_id === userId);
        const userWilayah = wilayahData?.filter(w => w.penagih_user_id === userId) || [];
        
        return {
          user_id: userId,
          email: '', // We don't have access to email from profiles
          full_name: profile?.full_name || 'Penagih',
          wilayah: userWilayah,
        };
      });

      setPenagihList(penagihWithWilayah);

      // Fetch users who could become penagih (those with anggota role or no penagih role)
      const { data: allRoles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      const usersNotPenagih = allProfiles?.filter(p => {
        const userRole = allRoles?.find(r => r.user_id === p.user_id);
        return !userRole || userRole.role !== 'penagih';
      }).map(p => ({
        user_id: p.user_id,
        email: '',
        full_name: p.full_name,
        role: allRoles?.find(r => r.user_id === p.user_id)?.role || 'anggota',
      })) || [];

      setAvailableUsers(usersNotPenagih);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ user_id: '', rt: '', rw: '' });
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

  const handleAddPenagih = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.user_id || !formData.rt || !formData.rw) {
      toast({
        variant: 'destructive',
        title: 'Data Belum Lengkap',
        description: StandardMessages.validation.required,
      });
      return;
    }

    setSubmitting(true);
    try {
      // Check if user already has penagih role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', formData.user_id)
        .eq('role', 'penagih')
        .maybeSingle();

      if (!existingRole) {
        // Add penagih role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: formData.user_id, role: 'penagih' });
        
        if (roleError) throw roleError;
      }

      // Add wilayah
      const { error: wilayahError } = await supabase
        .from('penagih_wilayah')
        .insert({
          penagih_user_id: formData.user_id,
          rt: formData.rt,
          rw: formData.rw,
        });

      if (wilayahError) throw wilayahError;

      toast({
        title: '✓ Penagih Ditambahkan',
        description: 'Penagih dan wilayah berhasil ditambahkan.',
      });
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Menambahkan',
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
        // Update existing
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
        // Add new wilayah
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

      // If no more wilayah, remove penagih role
      const remainingWilayah = selectedPenagih?.wilayah.filter(w => w.id !== selectedWilayah.id) || [];
      if (remainingWilayah.length === 0 && selectedPenagih) {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', selectedPenagih.user_id)
          .eq('role', 'penagih');
      }

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
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.wilayah.some(w => w.rt.includes(search) || w.rw.includes(search))
  );

  const columns = [
    {
      key: 'name',
      header: 'Nama Penagih',
      cell: (item: PenagihWithWilayah) => (
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <UserCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{item.full_name || 'Penagih'}</p>
            <p className="text-xs text-muted-foreground">{item.wilayah.length} wilayah</p>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Penagih Baru</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddPenagih} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Pilih User <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.user_id}
                  onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        <div className="flex flex-col">
                          <span>{user.full_name || 'User'}</span>
                          <span className="text-xs text-muted-foreground capitalize">
                            Role saat ini: {user.role}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  User akan otomatis mendapat role Penagih
                </p>
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
      </PageHeader>

      <div className="mt-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau wilayah..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {filteredPenagih.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum Ada Penagih"
            description="Klik tombol 'Tambah Penagih' untuk menambahkan penagih baru."
          />
        ) : (
          <>
            <DataTable columns={columns} data={filteredPenagih} />

            {/* Detail Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredPenagih.map((penagih) => (
                <Card key={penagih.user_id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-primary" />
                      {penagih.full_name || 'Penagih'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
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
              Penagih: <strong>{selectedPenagih?.full_name || 'Penagih'}</strong>
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
