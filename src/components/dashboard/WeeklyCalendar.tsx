import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, addWeeks, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Agendamento {
  id: string;
  nome_cliente: string;
  datetime_start: string;
  datetime_end: string;
  dia_agendado: string;
  hora_agendada: string;
  hora_final: string;
  servico: string;
  tempo_total_minutos: number;
  telefone_cliente?: string | null;
}

interface WeeklyCalendarProps {
  agendamentos: Agendamento[];
  onNovoAgendamento: () => void;
  onSelecionarAgendamento?: (agendamento: Agendamento) => void;
}

// Cores mais suaves e profissionais
const CORES_SERVICOS: Record<string, { bg: string; text: string; border: string }> = {
  "Barba": { bg: "bg-sky-500/20", text: "text-sky-300", border: "border-l-sky-500" },
  "Cabelo": { bg: "bg-violet-500/20", text: "text-violet-300", border: "border-l-violet-500" },
  "Sobrancelha": { bg: "bg-pink-500/20", text: "text-pink-300", border: "border-l-pink-500" },
  "Barba + Cabelo": { bg: "bg-emerald-500/20", text: "text-emerald-300", border: "border-l-emerald-500" },
  "Pezinho": { bg: "bg-amber-500/20", text: "text-amber-300", border: "border-l-amber-500" },
  "Barba + Cabelo + Sobrancelha": { bg: "bg-rose-500/20", text: "text-rose-300", border: "border-l-rose-500" },
};

const DEFAULT_COR = { bg: "bg-primary/20", text: "text-primary", border: "border-l-primary" };

const HORARIOS = Array.from({ length: 13 }, (_, i) => 8 + i);

const getBrasiliaTime = () => {
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const localOffset = now.getTimezoneOffset();
  const diff = brasiliaOffset - (-localOffset);
  return new Date(now.getTime() + diff * 60 * 1000);
};

export const WeeklyCalendar = ({ 
  agendamentos, 
  onNovoAgendamento,
  onSelecionarAgendamento 
}: WeeklyCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(getBrasiliaTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getBrasiliaTime());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const navegarSemana = (direcao: 'prev' | 'next') => {
    setCurrentDate(prev => addWeeks(prev, direcao === 'next' ? 1 : -1));
  };

  const irParaHoje = () => {
    setCurrentDate(new Date());
  };

  const diasSemana = useMemo(() => {
    const inicio = startOfWeek(currentDate, { weekStartsOn: 0 });
    const fim = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: inicio, end: fim });
  }, [currentDate]);

  const getAgendamentosDia = (dia: Date) => {
    return agendamentos.filter(ag => isSameDay(new Date(ag.datetime_start), dia));
  };

  const calcularPosicaoAgendamento = (agendamento: Agendamento) => {
    const inicio = new Date(agendamento.datetime_start);
    const horaInicio = inicio.getHours();
    const minutoInicio = inicio.getMinutes();
    const topPercent = ((horaInicio - 8) * 60 + minutoInicio) / (12 * 60) * 100;
    const heightPercent = (agendamento.tempo_total_minutos / (12 * 60)) * 100;
    return { top: `${topPercent}%`, height: `${Math.max(heightPercent, 4)}%` };
  };

  const getCorServico = (servico: string) => {
    return CORES_SERVICOS[servico] || DEFAULT_COR;
  };

  const rangeLabel = useMemo(() => {
    const inicio = startOfWeek(currentDate, { weekStartsOn: 0 });
    const fim = endOfWeek(currentDate, { weekStartsOn: 0 });
    
    if (inicio.getMonth() === fim.getMonth()) {
      return `${format(inicio, 'd')} - ${format(fim, 'd')} de ${format(fim, 'MMMM', { locale: ptBR })}`;
    }
    return `${format(inicio, 'd MMM', { locale: ptBR })} - ${format(fim, 'd MMM', { locale: ptBR })}`;
  }, [currentDate]);

  return (
    <div className="elegant-card overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navegarSemana('prev')}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium text-foreground min-w-[180px] text-center capitalize">
            {rangeLabel}
          </span>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navegarSemana('next')}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={irParaHoje}
            className="text-xs"
          >
            Hoje
          </Button>
        </div>
        
        <Button 
          onClick={onNovoAgendamento}
          className="btn-primary text-sm"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Agendamento</span>
        </Button>
      </div>
      
      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="min-w-[700px] flex flex-col h-full">
          {/* Days Header */}
          <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b border-border/50 bg-card shrink-0">
            <div className="p-2" />
            {diasSemana.map((dia) => (
              <div 
                key={dia.toISOString()} 
                className={cn(
                  "p-2 text-center border-l border-border/30",
                  isToday(dia) && "bg-primary/5"
                )}
              >
                <span className="text-xs text-muted-foreground block uppercase">
                  {format(dia, 'EEE', { locale: ptBR })}
                </span>
                <span className={cn(
                  "text-base font-semibold block",
                  isToday(dia) 
                    ? "text-primary" 
                    : "text-foreground"
                )}>
                  {format(dia, 'd')}
                </span>
              </div>
            ))}
          </div>

          {/* Time Grid - uses flex to fill available space */}
          <div className="grid grid-cols-[50px_repeat(7,1fr)] flex-1 min-h-0">
            {/* Hours Column */}
            <div className="flex flex-col">
              {HORARIOS.map((hora) => (
                <div 
                  key={hora} 
                  className="flex-1 flex items-start justify-end pr-2 min-h-[28px]"
                >
                  <span className="text-[10px] text-muted-foreground -mt-1">
                    {hora.toString().padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Days Columns */}
            {diasSemana.map((dia) => {
              const agendamentosDia = getAgendamentosDia(dia);
              const isPast = isBefore(startOfDay(dia), startOfDay(new Date()));
              const showCurrentTimeLine = isToday(dia);
              
              const currentHour = currentTime.getHours();
              const currentMinute = currentTime.getMinutes();
              const isWithinSchedule = currentHour >= 8 && currentHour < 20;
              const timeLinePosition = isWithinSchedule 
                ? ((currentHour - 8) * 60 + currentMinute) / (12 * 60) * 100 
                : -1;
              
              return (
                <div 
                  key={dia.toISOString()} 
                  className={cn(
                    "relative border-l border-border/30 flex flex-col",
                    isPast && "bg-muted/5",
                    isToday(dia) && "bg-primary/5"
                  )}
                >
                  {/* Hour slots */}
                  {HORARIOS.map((hora) => (
                    <div 
                      key={hora} 
                      className="flex-1 border-b border-border/20 hover:bg-secondary/30 transition-colors min-h-[28px]"
                    />
                  ))}
                  
                  {/* Current time line */}
                  {showCurrentTimeLine && isWithinSchedule && (
                    <div 
                      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                      style={{ top: `${timeLinePosition}%` }}
                    >
                      <div className="w-2 h-2 bg-accent rounded-full -ml-1" />
                      <div className="flex-1 h-[2px] bg-accent" />
                    </div>
                  )}
                  
                  {/* Appointments */}
                  <div className="absolute inset-0 pointer-events-none px-0.5">
                    {agendamentosDia.map((ag) => {
                      const pos = calcularPosicaoAgendamento(ag);
                      const cores = getCorServico(ag.servico);
                      
                      return (
                        <Tooltip key={ag.id}>
                          <TooltipTrigger asChild>
                            <div
                              onClick={() => onSelecionarAgendamento?.(ag)}
                              className={cn(
                                "absolute left-0.5 right-0.5 rounded-md px-1 py-0.5 overflow-hidden",
                                "cursor-pointer pointer-events-auto transition-all",
                                "hover:ring-2 hover:ring-primary/50 hover:z-30",
                                cores.bg, cores.border, "border-l-[3px]"
                              )}
                              style={{ top: pos.top, height: pos.height, minHeight: '24px' }}
                            >
                              <div className={cn("text-[9px] font-medium truncate", cores.text)}>
                                {ag.hora_agendada}
                              </div>
                              <div className="text-[10px] font-semibold text-foreground truncate">
                                {ag.nome_cliente}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <div className="text-sm font-semibold">{ag.nome_cliente}</div>
                            <div className="text-xs text-muted-foreground">{ag.servico}</div>
                            <div className="text-xs">{ag.hora_agendada} - {ag.hora_final}</div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
