import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: StatusVariant }> = {
  aktif: { label: 'Aktif', variant: 'success' },
  nonaktif: { label: 'Nonaktif', variant: 'default' },
  meninggal: { label: 'Meninggal', variant: 'error' },
  belum_bayar: { label: 'Belum Bayar', variant: 'warning' },
  menunggu_verifikasi: { label: 'Menunggu Verifikasi', variant: 'info' },
  lunas: { label: 'Lunas', variant: 'success' },
  ditolak: { label: 'Ditolak', variant: 'error' },
  pending: { label: 'Pending', variant: 'warning' },
  diproses: { label: 'Diproses', variant: 'info' },
  disalurkan: { label: 'Disalurkan', variant: 'success' },
};

const variantStyles: Record<StatusVariant, string> = {
  success: 'bg-success/10 text-success hover:bg-success/20 border-success/20',
  warning: 'bg-warning/10 text-warning hover:bg-warning/20 border-warning/20',
  error: 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20',
  info: 'bg-info/10 text-info hover:bg-info/20 border-info/20',
  default: 'bg-muted text-muted-foreground hover:bg-muted/80',
};

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: 'default' };
  const finalVariant = variant || config.variant;

  return (
    <Badge 
      variant="outline" 
      className={cn(variantStyles[finalVariant], className)}
    >
      {config.label}
    </Badge>
  );
}
