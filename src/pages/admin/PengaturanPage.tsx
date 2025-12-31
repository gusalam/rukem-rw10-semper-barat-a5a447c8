import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import type { Pengaturan } from '@/types/database';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage, StandardMessages } from '@/lib/error-messages';

export default function PengaturanPage() {
  const [pengaturan, setPengaturan] = useState<Pengaturan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    nama_rukem: '',
    nominal_iuran: '',
    periode_iuran: 'bulanan',
    nominal_santunan: '',
    aturan_tunggakan: '',
    nama_bank: '',
    nomor_rekening: '',
    nama_pemilik_rekening: '',
    qris_url: '',
  });
  const { toast } = useToast();

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Error', description: 'File harus berupa gambar' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Error', description: 'Ukuran file maksimal 5MB' });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `qris-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('qris')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('qris')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, qris_url: publicUrl }));
      toast({ title: 'Berhasil', description: 'Gambar QRIS berhasil diupload' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Gagal upload gambar' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveQris = () => {
    setFormData(prev => ({ ...prev, qris_url: '' }));
  };

  useEffect(() => {
    fetchPengaturan();
  }, []);

  const fetchPengaturan = async () => {
    try {
      const { data, error } = await supabase
        .from('pengaturan')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setPengaturan(data as Pengaturan);
        setFormData({
          nama_rukem: data.nama_rukem || '',
          nominal_iuran: data.nominal_iuran?.toString() || '',
          periode_iuran: data.periode_iuran || 'bulanan',
          nominal_santunan: data.nominal_santunan?.toString() || '',
          aturan_tunggakan: data.aturan_tunggakan || '',
          nama_bank: data.nama_bank || '',
          nomor_rekening: data.nomor_rekening || '',
          nama_pemilik_rekening: data.nama_pemilik_rekening || '',
          qris_url: data.qris_url || '',
        });
      }
    } catch (error) {
      console.error('Error fetching pengaturan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData = {
        nama_rukem: formData.nama_rukem,
        nominal_iuran: parseInt(formData.nominal_iuran) || 0,
        periode_iuran: formData.periode_iuran,
        nominal_santunan: parseInt(formData.nominal_santunan) || 0,
        aturan_tunggakan: formData.aturan_tunggakan || null,
        nama_bank: formData.nama_bank || null,
        nomor_rekening: formData.nomor_rekening || null,
        nama_pemilik_rekening: formData.nama_pemilik_rekening || null,
        qris_url: formData.qris_url || null,
      };

      if (pengaturan) {
        const { error } = await supabase
          .from('pengaturan')
          .update(updateData)
          .eq('id', pengaturan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pengaturan')
          .insert(updateData);
        if (error) throw error;
      }

      toast({ 
        title: '✓ Pengaturan Tersimpan', 
        description: StandardMessages.success.pengaturan.save,
      });
      fetchPengaturan();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Menyimpan',
        description: getErrorMessage(error, StandardMessages.error.save),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <PageHeader title="Pengaturan Sistem" description="Konfigurasi pengaturan RUKEM" />

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informasi Umum</CardTitle>
            <CardDescription>Pengaturan dasar organisasi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nama_rukem">Nama Rukun Kematian</Label>
              <Input
                id="nama_rukem"
                value={formData.nama_rukem}
                onChange={(e) => setFormData({ ...formData, nama_rukem: e.target.value })}
                placeholder="Rukun Kematian Sejahtera"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pengaturan Iuran</CardTitle>
            <CardDescription>Nominal dan periode iuran anggota</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nominal_iuran">Nominal Iuran (Rp)</Label>
                <Input
                  id="nominal_iuran"
                  type="number"
                  value={formData.nominal_iuran}
                  onChange={(e) => setFormData({ ...formData, nominal_iuran: e.target.value })}
                  placeholder="50000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periode_iuran">Periode Iuran</Label>
                <Input
                  id="periode_iuran"
                  value={formData.periode_iuran}
                  onChange={(e) => setFormData({ ...formData, periode_iuran: e.target.value })}
                  placeholder="bulanan"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="aturan_tunggakan">Aturan Tunggakan</Label>
              <Textarea
                id="aturan_tunggakan"
                value={formData.aturan_tunggakan}
                onChange={(e) => setFormData({ ...formData, aturan_tunggakan: e.target.value })}
                placeholder="Tunggakan maksimal 3 bulan..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pengaturan Santunan</CardTitle>
            <CardDescription>Nominal santunan yang diberikan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nominal_santunan">Nominal Santunan (Rp)</Label>
              <Input
                id="nominal_santunan"
                type="number"
                value={formData.nominal_santunan}
                onChange={(e) => setFormData({ ...formData, nominal_santunan: e.target.value })}
                placeholder="5000000"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informasi Pembayaran</CardTitle>
            <CardDescription>Rekening tujuan pembayaran iuran</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nama_bank">Nama Bank</Label>
                <Input
                  id="nama_bank"
                  value={formData.nama_bank}
                  onChange={(e) => setFormData({ ...formData, nama_bank: e.target.value })}
                  placeholder="BCA / BRI / Mandiri"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nomor_rekening">Nomor Rekening</Label>
                <Input
                  id="nomor_rekening"
                  value={formData.nomor_rekening}
                  onChange={(e) => setFormData({ ...formData, nomor_rekening: e.target.value })}
                  placeholder="1234567890"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nama_pemilik_rekening">Nama Pemilik Rekening</Label>
              <Input
                id="nama_pemilik_rekening"
                value={formData.nama_pemilik_rekening}
                onChange={(e) => setFormData({ ...formData, nama_pemilik_rekening: e.target.value })}
                placeholder="Bendahara RUKEM"
              />
            </div>
            <div className="space-y-2">
              <Label>QRIS (opsional)</Label>
              <div className="space-y-3">
                {formData.qris_url && (
                  <div className="relative w-48 h-48 border rounded-lg overflow-hidden bg-muted">
                    <img 
                      src={formData.qris_url} 
                      alt="QRIS" 
                      className="w-full h-full object-contain"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={handleRemoveQris}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    id="qris_url"
                    value={formData.qris_url}
                    onChange={(e) => setFormData({ ...formData, qris_url: e.target.value })}
                    placeholder="URL gambar QRIS..."
                    className="flex-1"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleQrisUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload gambar QRIS atau masukkan URL gambar
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Simpan Pengaturan
              </>
            )}
          </Button>
        </div>
      </form>
    </AdminLayout>
  );
}
