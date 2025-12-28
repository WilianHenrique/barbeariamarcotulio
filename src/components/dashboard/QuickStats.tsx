import { Calendar, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickStatsProps {
  totalPendentes: number;
  proximas24h: number;
  realizados: number;
  totalMes: number;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  variant?: "default" | "warning" | "success";
}

const StatCard = ({ label, value, icon: Icon, variant = "default" }: StatCardProps) => {
  const variantStyles = {
    default: "border-border/50 hover:border-primary/30",
    warning: "border-amber-500/20 hover:border-amber-500/40",
    success: "border-emerald-500/20 hover:border-emerald-500/40",
  };

  const iconStyles = {
    default: "text-primary bg-primary/10",
    warning: "text-amber-500 bg-amber-500/10",
    success: "text-emerald-500 bg-emerald-500/10",
  };

  const valueStyles = {
    default: "text-foreground",
    warning: "text-amber-500",
    success: "text-emerald-500",
  };

  return (
    <div className={cn(
      "elegant-card p-4 flex items-center gap-4",
      variantStyles[variant]
    )}>
      <div className={cn("p-2.5 rounded-lg", iconStyles[variant])}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </p>
        <p className={cn("text-2xl font-display font-semibold", valueStyles[variant])}>
          {value}
        </p>
      </div>
    </div>
  );
};

export const QuickStats = ({ totalPendentes, proximas24h, realizados, totalMes }: QuickStatsProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard 
        label="Pendentes" 
        value={totalPendentes} 
        icon={Calendar}
      />
      <StatCard 
        label="Pendentes Hoje" 
        value={proximas24h} 
        icon={Clock}
        variant="warning"
      />
      <StatCard 
        label="Realizados hoje" 
        value={realizados} 
        icon={CheckCircle2}
        variant="success"
      />
      <StatCard 
        label="Total do Mês" 
        value={totalMes} 
        icon={TrendingUp}
      />
    </div>
  );
};
