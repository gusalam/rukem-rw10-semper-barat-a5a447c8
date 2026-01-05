import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  tooltip?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  iconClassName?: string;
  variant?: "default" | "warning" | "danger";
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  tooltip,
  trend,
  className,
  iconClassName,
  variant = "default",
}: StatCardProps) {
  const variantStyles = {
    default: "",
    warning: "border-warning/50 bg-warning/5",
    danger: "border-destructive/50 bg-destructive/5",
  };

  return (
    <div className={cn(
      "rounded-lg border bg-card p-6 shadow-sm transition-all hover:shadow-md",
      variantStyles[variant],
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[250px] text-center">
                  <p className="text-xs">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className={cn(
          "rounded-lg p-2 bg-primary/10",
          iconClassName
        )}>
          <Icon className={cn(
            "h-5 w-5 text-primary",
            variant === "warning" && "text-warning",
            variant === "danger" && "text-destructive"
          )} />
        </div>
      </div>
      <div className="mt-3">
        <p className={cn(
          "text-2xl font-bold tracking-tight",
          variant === "warning" && "text-warning",
          variant === "danger" && "text-destructive"
        )}>{value}</p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
        {trend && (
          <p className={cn(
            "mt-1 text-xs font-medium",
            trend.isPositive ? "text-success" : "text-destructive"
          )}>
            {trend.isPositive ? "+" : "-"}{trend.value}% dari bulan lalu
          </p>
        )}
      </div>
    </div>
  );
}
