import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Users,
  ArrowRight,
  Play,
  Loader2,
  Home
} from 'lucide-react';
import type { Anggota, StatusDalamKK } from '@/types/database';

const STATUS_DALAM_KK_OPTIONS: { value: StatusDalamKK; label: string }[] = [
  { value: 'kepala_keluarga', label: 'Kepala Keluarga' },
  { value: 'istri', label: 'Istri' },
  { value: 'anak', label: 'Anak' },
  { value: 'orang_tua', label: 'Orang Tua' },
  { value: 'famili', label: 'Famili' },
  { value: 'lainnya', label: 'Lainnya' },
];

// Mapping dari hubungan_kk lama ke status_dalam_kk baru
const HUBUNGAN_KK_MAPPING: Record<string, StatusDalamKK> = {
  'kepala keluarga': 'kepala_keluarga',
  'kepala_keluarga': 'kepala_keluarga',
  'suami': 'kepala_keluarga',
  'istri': 'istri',
  'anak': 'anak',
  'anak kandung': 'anak',
  'anak angkat': 'anak',
  'anak tiri': 'anak',
  'orang tua': 'orang_tua',
  'orang_tua': 'orang_tua',
  'ayah': 'orang_tua',
  'ibu': 'orang_tua',
  'mertua': 'orang_tua',
  'famili': 'famili',
  'keluarga': 'famili',
  'saudara': 'famili',
  'kakak': 'famili',
  'adik': 'famili',
  'cucu': 'famili',
  'lainnya': 'lainnya',
  'pembantu': 'lainnya',
  'lain-lain': 'lainnya',
};

interface MigrationStats {
  totalAnggota: number;
  sudahMigrated: number;
  belumMigrated: number;
  bisaAutoMigrate: number;
  perluManual: number;
}

interface AnggotaToMigrate extends Anggota {
  suggestedStatus?: StatusDalamKK;
  canAutoMigrate?: boolean;
}

export default function MigrasiDataPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MigrationStats>({
    totalAnggota: 0,
    sudahMigrated: 0,
    belumMigrated: 0,
    bisaAutoMigrate: 0,
    perluManual: 0,
  });
  const [anggotaBelumMigrate, setAnggotaBelumMigrate] = useState<AnggotaToMigrate[]>([]);
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationLog, setMigrationLog] = useState<string[]>([]);
  
  // Manual assignment state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAnggota, setSelectedAnggota] = useState<AnggotaToMigrate | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusDalamKK>('lainnya');
  const [submitting, setSubmitting] = useState(false);
  
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all anggota
      const { count: totalAnggota } = await supabase
        .from('anggota')
        .select('*', { count: 'exact', head: true });

      // Fetch anggota yang sudah punya status_dalam_kk
      const { count: sudahMigrated } = await supabase
        .from('anggota')
        .select('*', { count: 'exact', head: true })
        .not('status_dalam_kk', 'is', null);

      // Fetch anggota yang belum punya status_dalam_kk
      const { data: belumData } = await supabase
        .from('anggota')
        .select('*')
        .is('status_dalam_kk', null)
        .order('no_kk')
        .limit(100); // Limit for performance

      // Process data to suggest status
      const processedData: AnggotaToMigrate[] = (belumData || []).map(anggota => {
        const hubungan = (anggota.hubungan_kk || '').toLowerCase().trim();
        const suggestedStatus = HUBUNGAN_KK_MAPPING[hubungan];
        return {
          ...anggota,
          suggestedStatus,
          canAutoMigrate: !!suggestedStatus,
        };
      });

      const bisaAutoMigrate = processedData.filter(a => a.canAutoMigrate).length;
      const perluManual = processedData.filter(a => !a.canAutoMigrate).length;

      setStats({
        totalAnggota: totalAnggota || 0,
        sudahMigrated: sudahMigrated || 0,
        belumMigrated: (totalAnggota || 0) - (sudahMigrated || 0),
        bisaAutoMigrate,
        perluManual,
      });
      setAnggotaBelumMigrate(processedData);
    } catch (error) {
      console.error('Error fetching migration data:', error);
      toast({
        variant: 'destructive',
        title: 'Gagal Memuat Data',
        description: 'Tidak dapat mengambil data migrasi.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const runAutoMigration = async () => {
    const autoMigrateData = anggotaBelumMigrate.filter(a => a.canAutoMigrate && a.suggestedStatus);
    if (autoMigrateData.length === 0) {
      toast({
        title: 'Tidak Ada Data',
        description: 'Tidak ada data yang bisa dimigrasi otomatis.',
      });
      return;
    }

    setMigrating(true);
    setMigrationProgress(0);
    setMigrationLog([]);

    try {
      let success = 0;
      let failed = 0;
      const total = autoMigrateData.length;

      for (let i = 0; i < autoMigrateData.length; i++) {
        const anggota = autoMigrateData[i];
        try {
          const { error } = await supabase
            .from('anggota')
            .update({ status_dalam_kk: anggota.suggestedStatus })
            .eq('id', anggota.id);

          if (error) {
            failed++;
            setMigrationLog(prev => [...prev, `❌ Gagal: ${anggota.nama_lengkap} - ${error.message}`]);
          } else {
            success++;
            setMigrationLog(prev => [...prev, `✓ ${anggota.nama_lengkap} → ${anggota.suggestedStatus}`]);
          }
        } catch (err) {
          failed++;
          setMigrationLog(prev => [...prev, `❌ Error: ${anggota.nama_lengkap}`]);
        }

        setMigrationProgress(Math.round(((i + 1) / total) * 100));
      }

      toast({
        title: '✓ Migrasi Selesai',
        description: `${success} berhasil, ${failed} gagal dari ${total} data.`,
      });

      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Error during migration:', error);
      toast({
        variant: 'destructive',
        title: 'Migrasi Gagal',
        description: 'Terjadi kesalahan saat memproses migrasi.',
      });
    } finally {
      setMigrating(false);
    }
  };

  const handleManualAssign = async () => {
    if (!selectedAnggota || !selectedStatus) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('anggota')
        .update({ status_dalam_kk: selectedStatus })
        .eq('id', selectedAnggota.id);

      if (error) throw error;

      toast({
        title: '✓ Status Diperbarui',
        description: `${selectedAnggota.nama_lengkap} → ${STATUS_DALAM_KK_OPTIONS.find(o => o.value === selectedStatus)?.label}`,
      });

      setAssignDialogOpen(false);
      setSelectedAnggota(null);
      await fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal Menyimpan',
        description: error.message || 'Terjadi kesalahan.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openAssignDialog = (anggota: AnggotaToMigrate) => {
    setSelectedAnggota(anggota);
    setSelectedStatus(anggota.suggestedStatus || 'lainnya');
    setAssignDialogOpen(true);
  };

  const columns = [
    {
      key: 'nama_lengkap',
      header: 'Nama',
      cell: (item: AnggotaToMigrate) => (
        <div>
          <p className="font-medium">{item.nama_lengkap}</p>
          <p className="text-xs text-muted-foreground">{item.nik}</p>
        </div>
      ),
    },
    {
      key: 'no_kk',
      header: 'No. KK',
      className: 'hidden md:table-cell',
    },
    {
      key: 'hubungan_kk',
      header: 'Hubungan KK (Lama)',
      cell: (item: AnggotaToMigrate) => (
        <span className="text-sm">{item.hubungan_kk || '-'}</span>
      ),
    },
    {
      key: 'suggested',
      header: 'Saran Status',
      cell: (item: AnggotaToMigrate) => (
        item.suggestedStatus ? (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            {STATUS_DALAM_KK_OPTIONS.find(o => o.value === item.suggestedStatus)?.label}
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
            Perlu Manual
          </Badge>
        )
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (item: AnggotaToMigrate) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: '',
      cell: (item: AnggotaToMigrate) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openAssignDialog(item)}
        >
          Atur Manual
        </Button>
      ),
    },
  ];

  const progressPercentage = stats.totalAnggota > 0 
    ? Math.round((stats.sudahMigrated / stats.totalAnggota) * 100) 
    : 0;

  return (
    <AdminLayout>
      <PageHeader 
        title="Migrasi Data" 
        description="Perbaiki dan lengkapi data status_dalam_kk anggota"
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Anggota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAnggota.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sudah Migrasi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.sudahMigrated.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Belum Migrasi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.belumMigrated.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Progress value={progressPercentage} className="h-2 flex-1" />
              <span className="text-sm font-medium">{progressPercentage}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Migration Complete */}
      {stats.belumMigrated === 0 && !loading && (
        <Alert className="mb-6 border-success bg-success/10">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertDescription className="text-success">
            Semua data anggota sudah memiliki status_dalam_kk. Migrasi selesai!
          </AlertDescription>
        </Alert>
      )}

      {/* Auto Migration Section */}
      {stats.belumMigrated > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Migrasi Otomatis
            </CardTitle>
            <CardDescription>
              Sistem dapat mengisi otomatis {stats.bisaAutoMigrate} data berdasarkan kolom hubungan_kk lama. 
              {stats.perluManual > 0 && ` ${stats.perluManual} data perlu diisi manual.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {migrating ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Memproses migrasi...</span>
                </div>
                <Progress value={migrationProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">{migrationProgress}% selesai</p>
                
                {migrationLog.length > 0 && (
                  <div className="max-h-40 overflow-y-auto bg-muted/50 rounded-lg p-3 text-xs font-mono">
                    {migrationLog.slice(-10).map((log, idx) => (
                      <div key={idx}>{log}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={runAutoMigration}
                  disabled={stats.bisaAutoMigrate === 0}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Jalankan Migrasi Otomatis ({stats.bisaAutoMigrate} data)
                </Button>
                <Button variant="outline" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Data Belum Migrasi
          </CardTitle>
          <CardDescription>
            Menampilkan maksimal 100 data. Jalankan migrasi otomatis terlebih dahulu untuk data yang bisa dipetakan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : anggotaBelumMigrate.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Semua Data Sudah Migrasi"
              description="Tidak ada lagi data yang perlu dimigrasi"
            />
          ) : (
            <DataTable data={anggotaBelumMigrate} columns={columns} />
          )}
        </CardContent>
      </Card>

      {/* Manual Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atur Status Dalam KK</DialogTitle>
            <DialogDescription>
              Pilih status dalam keluarga untuk anggota ini.
            </DialogDescription>
          </DialogHeader>

          {selectedAnggota && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">{selectedAnggota.nama_lengkap}</p>
                <p className="text-xs text-muted-foreground">KK: {selectedAnggota.no_kk}</p>
                {selectedAnggota.hubungan_kk && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Hubungan KK (lama): <span className="font-medium">{selectedAnggota.hubungan_kk}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status Dalam KK</label>
                <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as StatusDalamKK)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_DALAM_KK_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAssignDialogOpen(false)} disabled={submitting}>
                  Batal
                </Button>
                <Button onClick={handleManualAssign} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Simpan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
