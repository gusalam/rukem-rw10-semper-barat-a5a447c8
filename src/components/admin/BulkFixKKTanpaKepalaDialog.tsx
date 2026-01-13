import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Home, 
  Users, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { Anggota } from '@/types/database';

interface KKGroup {
  no_kk: string;
  anggota: Anggota[];
  hasKepala: boolean;
}

interface BulkFixKKTanpaKepalaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kkTanpaKepala: KKGroup[];
  onSuccess: () => void;
}

interface KKSelection {
  no_kk: string;
  selectedAnggotaId: string | null;
  anggotaOptions: Anggota[];
  expanded: boolean;
}

export function BulkFixKKTanpaKepalaDialog({
  open,
  onOpenChange,
  kkTanpaKepala,
  onSuccess,
}: BulkFixKKTanpaKepalaDialogProps) {
  const [selections, setSelections] = useState<KKSelection[]>([]);
  const [selectedKKs, setSelectedKKs] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  const [showResults, setShowResults] = useState(false);
  const { toast } = useToast();

  // Priority order for auto-assign: istri > oldest anak > famili > orang_tua > lainnya
  const getAutoSelectedKepala = (activeMembers: Anggota[]): string | null => {
    if (activeMembers.length === 0) return null;
    if (activeMembers.length === 1) return activeMembers[0].id;

    // Priority order
    const priorityOrder = ['istri', 'anak', 'famili', 'orang_tua', 'lainnya', null];
    
    // Find by priority
    for (const priority of priorityOrder) {
      const candidates = activeMembers.filter(a => a.status_dalam_kk === priority);
      
      if (candidates.length > 0) {
        // For 'anak', pick the oldest (smallest tanggal_lahir)
        if (priority === 'anak' && candidates.length > 1) {
          const sorted = [...candidates].sort((a, b) => {
            if (!a.tanggal_lahir && !b.tanggal_lahir) return 0;
            if (!a.tanggal_lahir) return 1;
            if (!b.tanggal_lahir) return -1;
            return new Date(a.tanggal_lahir).getTime() - new Date(b.tanggal_lahir).getTime();
          });
          return sorted[0].id;
        }
        return candidates[0].id;
      }
    }

    // Fallback to first member
    return activeMembers[0].id;
  };

  // Initialize selections when dialog opens
  useEffect(() => {
    if (open && kkTanpaKepala.length > 0) {
      const initialSelections = kkTanpaKepala.map(kk => {
        const activeMembers = kk.anggota.filter(a => a.status === 'aktif');
        // Auto-select based on priority: istri > oldest anak > famili
        const autoSelected = getAutoSelectedKepala(activeMembers);
        return {
          no_kk: kk.no_kk,
          selectedAnggotaId: autoSelected,
          anggotaOptions: activeMembers,
          expanded: false,
        };
      });
      setSelections(initialSelections);
      
      // Auto-select all KKs that have auto-selected members
      const autoSelectedKKs = new Set(
        initialSelections
          .filter(s => s.selectedAnggotaId !== null)
          .map(s => s.no_kk)
      );
      setSelectedKKs(autoSelectedKKs);
      setShowResults(false);
      setProgress(0);
      setResults({ success: 0, failed: 0 });
    }
  }, [open, kkTanpaKepala]);

  // Count KKs ready to fix (selected + has kepala chosen)
  const readyToFix = useMemo(() => {
    return selections.filter(s => 
      selectedKKs.has(s.no_kk) && s.selectedAnggotaId !== null
    ).length;
  }, [selections, selectedKKs]);

  const handleSelectAll = () => {
    if (selectedKKs.size === selections.length) {
      setSelectedKKs(new Set());
    } else {
      setSelectedKKs(new Set(selections.map(s => s.no_kk)));
    }
  };

  const handleToggleKK = (no_kk: string) => {
    const newSet = new Set(selectedKKs);
    if (newSet.has(no_kk)) {
      newSet.delete(no_kk);
    } else {
      newSet.add(no_kk);
    }
    setSelectedKKs(newSet);
  };

  const handleSelectKepala = (no_kk: string, anggotaId: string) => {
    setSelections(prev => prev.map(s => 
      s.no_kk === no_kk ? { ...s, selectedAnggotaId: anggotaId } : s
    ));
  };

  const handleToggleExpand = (no_kk: string) => {
    setSelections(prev => prev.map(s => 
      s.no_kk === no_kk ? { ...s, expanded: !s.expanded } : s
    ));
  };

  const handleBulkFix = async () => {
    const toFix = selections.filter(s => 
      selectedKKs.has(s.no_kk) && s.selectedAnggotaId !== null
    );

    if (toFix.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Tidak Ada Data',
        description: 'Pilih minimal satu KK dan tentukan Kepala Keluarga-nya.',
      });
      return;
    }

    setProcessing(true);
    setProgress(0);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < toFix.length; i++) {
      const { no_kk, selectedAnggotaId } = toFix[i];
      
      try {
        const { error } = await supabase
          .from('anggota')
          .update({ status_dalam_kk: 'kepala_keluarga' })
          .eq('id', selectedAnggotaId);

        if (error) throw error;
        success++;
      } catch (error) {
        console.error(`Failed to update KK ${no_kk}:`, error);
        failed++;
      }

      setProgress(Math.round(((i + 1) / toFix.length) * 100));
    }

    setResults({ success, failed });
    setShowResults(true);
    setProcessing(false);

    if (success > 0) {
      toast({
        title: `✓ ${success} KK Berhasil Diperbaiki`,
        description: failed > 0 ? `${failed} KK gagal diproses.` : 'Semua KK berhasil mendapat Kepala Keluarga.',
      });
    }
  };

  const handleClose = () => {
    if (!processing) {
      if (showResults && results.success > 0) {
        onSuccess();
      }
      onOpenChange(false);
    }
  };

  const getStatusLabel = (status: string | null) => {
    if (!status) return '-';
    const map: Record<string, string> = {
      'kepala_keluarga': 'Kepala',
      'istri': 'Istri',
      'anak': 'Anak',
      'orang_tua': 'Ortu',
      'famili': 'Famili',
      'lainnya': 'Lain',
    };
    return map[status] || status;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-warning" />
            Perbaiki KK Tanpa Kepala (Bulk)
          </DialogTitle>
          <DialogDescription>
            Pilih Kepala Keluarga untuk setiap KK yang belum memiliki kepala.
          </DialogDescription>
        </DialogHeader>

        {showResults ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto text-success" />
            <div>
              <p className="text-lg font-semibold">Proses Selesai</p>
              <p className="text-muted-foreground">
                {results.success} KK berhasil diperbaiki
                {results.failed > 0 && `, ${results.failed} gagal`}
              </p>
            </div>
            <Button onClick={handleClose}>Tutup</Button>
          </div>
        ) : (
          <>
            {/* Stats & Select All */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedKKs.size === selections.length && selections.length > 0}
                    onCheckedChange={handleSelectAll}
                    disabled={processing}
                  />
                  <span className="text-sm font-medium">Pilih Semua</span>
                </div>
                <Badge variant="outline">
                  {selectedKKs.size} / {selections.length} KK dipilih
                </Badge>
              </div>
              <Badge variant={readyToFix > 0 ? 'default' : 'secondary'}>
                {readyToFix} siap diperbaiki
              </Badge>
            </div>

            {/* Progress Bar */}
            {processing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  Memproses... {progress}%
                </p>
              </div>
            )}

            {/* KK List */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {selections.map((selection) => (
                  <div 
                    key={selection.no_kk}
                    className={`border rounded-lg transition-colors ${
                      selectedKKs.has(selection.no_kk) 
                        ? 'border-primary/50 bg-primary/5' 
                        : 'border-border'
                    }`}
                  >
                    <div className="p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedKKs.has(selection.no_kk)}
                          onCheckedChange={() => handleToggleKK(selection.no_kk)}
                          disabled={processing}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Home className="h-4 w-4 text-muted-foreground" />
                              <span className="font-mono text-sm">{selection.no_kk}</span>
                              <Badge variant="secondary" className="text-xs">
                                {selection.anggotaOptions.length} anggota aktif
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleExpand(selection.no_kk)}
                              disabled={processing}
                            >
                              {selection.expanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>

                          {/* Kepala Selection */}
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="text-sm text-muted-foreground">Kepala Baru:</span>
                            {selection.anggotaOptions.length === 0 ? (
                              <Badge variant="destructive" className="text-xs">
                                Tidak ada anggota aktif
                              </Badge>
                            ) : selection.anggotaOptions.length === 1 ? (
                              <Badge variant="default" className="text-xs">
                                {selection.anggotaOptions[0].nama_lengkap} (otomatis)
                              </Badge>
                            ) : (
                              <Select
                                value={selection.selectedAnggotaId || ''}
                                onValueChange={(v) => handleSelectKepala(selection.no_kk, v)}
                                disabled={processing}
                              >
                                <SelectTrigger className="h-8 w-[200px]">
                                  <SelectValue placeholder="Pilih kepala..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {selection.anggotaOptions.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>
                                      {a.nama_lengkap} ({getStatusLabel(a.status_dalam_kk)})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          {/* Expanded Member List */}
                          {selection.expanded && (
                            <div className="mt-3 pl-6 space-y-1">
                              {selection.anggotaOptions.map((a) => (
                                <div 
                                  key={a.id}
                                  className={`text-sm py-1 px-2 rounded ${
                                    selection.selectedAnggotaId === a.id 
                                      ? 'bg-primary/10 text-primary font-medium' 
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  {a.nama_lengkap} - {getStatusLabel(a.status_dalam_kk)}
                                  {selection.selectedAnggotaId === a.id && (
                                    <Badge variant="default" className="ml-2 text-xs">
                                      Akan jadi Kepala
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Warning for unselected kepala */}
            {selectedKKs.size > 0 && readyToFix < selectedKKs.size && (
              <Alert variant="default" className="border-warning bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-sm">
                  {selectedKKs.size - readyToFix} KK terpilih belum memiliki Kepala Keluarga yang ditentukan.
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {readyToFix} KK akan diupdate
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} disabled={processing}>
                  Batal
                </Button>
                <Button 
                  onClick={handleBulkFix} 
                  disabled={processing || readyToFix === 0}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Perbaiki {readyToFix} KK
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
