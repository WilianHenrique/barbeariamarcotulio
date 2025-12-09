import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Phone, Clock, Scissors } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Agendamento {
  id: string;
  nome_cliente: string;
  datetime_start: string;
  dia_agendado: string;
  hora_agendada: string;
  hora_final: string;
  servico: string;
  tempo_total_minutos: number;
  telefone_cliente?: string | null;
  notificacao_24h_enviada?: boolean;
  notificacao_1h_enviada?: boolean;
}

interface AppointmentListProps {
  agendamentos: Agendamento[];
  isLoading: boolean;
  onDelete: (id: string, nome: string) => void;
  emptyMessage?: string;
}

const formatarTelefone = (telefone: string) => {
  if (telefone.length === 11) {
    return `(${telefone.slice(0, 2)}) ${telefone.slice(2, 3)} ${telefone.slice(3, 7)}-${telefone.slice(7)}`;
  }
  return telefone;
};

export const AppointmentList = ({ 
  agendamentos, 
  isLoading, 
  onDelete,
  emptyMessage = "Nenhum agendamento encontrado"
}: AppointmentListProps) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="elegant-card p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-secondary rounded w-1/3" />
                <div className="h-3 bg-secondary rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (agendamentos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Agrupar por data
  const agendamentosPorData = agendamentos.reduce((acc, ag) => {
    const data = ag.dia_agendado;
    if (!acc[data]) acc[data] = [];
    acc[data].push(ag);
    return acc;
  }, {} as Record<string, Agendamento[]>);

  return (
    <div className="space-y-6">
      {Object.entries(agendamentosPorData).map(([data, items]) => (
        <div key={data} className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {format(new Date(data + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </h3>
          
          <div className="space-y-2">
            {items.map((ag) => {
              const agora = new Date();
              const dataEvento = new Date(ag.datetime_start);
              const isPast = dataEvento < agora;
              const horasRestantes = (dataEvento.getTime() - agora.getTime()) / (1000 * 60 * 60);
              const isUrgent = horasRestantes > 0 && horasRestantes <= 2;

              return (
                <div 
                  key={ag.id} 
                  className={cn(
                    "elegant-card p-4 flex items-center gap-4 group",
                    isPast && "opacity-60"
                  )}
                >
                  {/* Time Block */}
                  <div className={cn(
                    "w-16 h-16 rounded-lg flex flex-col items-center justify-center shrink-0",
                    isUrgent ? "bg-amber-500/10" : "bg-primary/10"
                  )}>
                    <span className={cn(
                      "text-lg font-semibold",
                      isUrgent ? "text-amber-500" : "text-primary"
                    )}>
                      {ag.hora_agendada}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ag.tempo_total_minutos}min
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">
                      {ag.nome_cliente}
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Scissors className="w-3.5 h-3.5" />
                        {ag.servico}
                      </span>
                      {ag.telefone_cliente && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {formatarTelefone(ag.telefone_cliente)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="hidden sm:block">
                    {ag.notificacao_24h_enviada && ag.notificacao_1h_enviada ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        Notificado
                      </Badge>
                    ) : isPast ? (
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                        Concluído
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                        Pendente
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(ag.id, ag.nome_cliente)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
