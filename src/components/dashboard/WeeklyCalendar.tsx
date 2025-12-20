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

const getBrasiliaTime = () => {
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const localOffset = now.getTimezoneOffset();
  const diff = brasiliaOffset - (-localOffset);
  return new Date(now.getTime() + diff * 60 * 1000);
};

// Gera slots de tempo dinâmicos baseado nos agendamentos
const gerarSlotsTempoSemanais = (agendamentos: Agendamento[]) => {
  // Coleta todos os horários de início dos agendamentos
  const horariosUsados = new Set<string>();
  
  agendamentos.forEach(ag => {
    const inicio = new Date(ag.datetime_start);
    const hora = inicio.getHours();
    const minuto = inicio.getMinutes();
    
    // Adiciona o horário exato do agendamento
    if (hora >= 8 && hora < 20) {
      horariosUsados.add(`${hora}:${minuto}`);
    }
  });

  // Gera os slots base (de hora em hora, das 8h às 20h)
  const slots: { hora: number; minuto: number; label: string }[] = [];
  
  for (let h = 8; h <= 20; h++) {
    slots.push({ hora: h, minuto: 0, label: `${h.toString().padStart(2, '0')}:00` });
    
    // Se há agendamentos em :30 desta hora, adiciona o slot de 30 min
    if (horariosUsados.has(`${h}:30`)) {
      slots.push({ hora: h, minuto: 30, label: `${h.toString().padStart(2, '0')}:30` });
    }
    
    // Se há agendamentos em outros minutos, adiciona slots específicos
    [15, 45].forEach(min => {
      if (horariosUsados.has(`${h}:${min}`)) {
        slots.push({ hora: h, minuto: min, label: `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}` });
      }
    });
  }

  // Ordena por horário
  slots.sort((a, b) => (a.hora * 60 + a.minuto) - (b.hora * 60 + b.minuto));
  
  return slots;
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
    const hoje = startOfDay(new Date());
    const inicioSemana = startOfWeek(currentDate, { weekStartsOn: 0 });
    const fimSemana = endOfWeek(currentDate, { weekStartsOn: 0 });

    const todosDias = eachDayOfInterval({ start: inicioSemana, end: fimSemana });

    // Se a semana inteira está no passado, mantém todos os dias (permite navegar para trás)
    if (isBefore(fimSemana, hoje)) {
      return todosDias;
    }

    // Se a semana é totalmente futura (início hoje ou depois), mantém todos os dias
    if (!isBefore(inicioSemana, hoje)) {
      return todosDias;
    }

    // Semana que contém o dia de hoje: mostra apenas de hoje em diante
    return todosDias.filter((dia) => !isBefore(startOfDay(dia), hoje));
  }, [currentDate]);

  // Gera slots dinâmicos baseado nos agendamentos da semana
  const slotsHorarios = useMemo(() => {
    const agendamentosSemana = agendamentos.filter(ag => {
      const dataAg = new Date(ag.datetime_start);
      return diasSemana.some(dia => isSameDay(dataAg, dia));
    });
    return gerarSlotsTempoSemanais(agendamentosSemana);
  }, [agendamentos, diasSemana]);

  const getAgendamentosDia = (dia: Date) => {
    return agendamentos.filter(ag => isSameDay(new Date(ag.datetime_start), dia));
  };

  const SLOT_HEIGHT = 50; // altura fixa de cada slot em pixels

  // Calcula posição baseado nos slots dinâmicos
  const calcularPosicaoAgendamento = (agendamento: Agendamento) => {
    const inicio = new Date(agendamento.datetime_start);
    const horaInicio = inicio.getHours();
    const minutoInicio = inicio.getMinutes();
    
    // Encontra o índice do slot correspondente ou o mais próximo anterior
    let slotIndex = 0;
    for (let i = 0; i < slotsHorarios.length; i++) {
      const slot = slotsHorarios[i];
      const slotMinutos = slot.hora * 60 + slot.minuto;
      const agMinutos = horaInicio * 60 + minutoInicio;
      
      if (slotMinutos <= agMinutos) {
        slotIndex = i;
      } else {
        break;
      }
    }
    
    // Calcula offset dentro do slot
    const slotAtual = slotsHorarios[slotIndex];
    const proximoSlot = slotsHorarios[slotIndex + 1];
    
    const slotAtualMinutos = slotAtual.hora * 60 + slotAtual.minuto;
    const agMinutos = horaInicio * 60 + minutoInicio;
    
    let duracaoSlot = 60; // padrão 1 hora
    if (proximoSlot) {
      duracaoSlot = (proximoSlot.hora * 60 + proximoSlot.minuto) - slotAtualMinutos;
    }
    
    const offsetDentroSlot = (agMinutos - slotAtualMinutos) / duracaoSlot;
    
    const topPx = (slotIndex + offsetDentroSlot) * SLOT_HEIGHT;
    
    // Calcula altura baseada na duração em minutos
    // Proporção: SLOT_HEIGHT pixels por duracaoSlot minutos
    const alturaMinuto = SLOT_HEIGHT / 60; // pixels por minuto (assumindo slot padrão de 1h)
    const heightPx = Math.max(agendamento.tempo_total_minutos * alturaMinuto, 40);
    
    return { 
      top: `${topPx}px`, 
      height: `${heightPx}px`
    };
  };

  const getCorServico = (servico: string) => {
    return CORES_SERVICOS[servico] || DEFAULT_COR;
  };

  const rangeLabel = useMemo(() => {
    if (!diasSemana.length) {
      const inicio = startOfWeek(currentDate, { weekStartsOn: 0 });
      const fim = endOfWeek(currentDate, { weekStartsOn: 0 });
      if (inicio.getMonth() === fim.getMonth()) {
        return `${format(inicio, 'd')} - ${format(fim, 'd')} de ${format(fim, 'MMMM', { locale: ptBR })}`;
      }
      return `${format(inicio, 'd MMM', { locale: ptBR })} - ${format(fim, 'd MMM', { locale: ptBR })}`;
    }

    const inicio = diasSemana[0];
    const fim = diasSemana[diasSemana.length - 1];

    if (inicio.getMonth() === fim.getMonth()) {
      return `${format(inicio, 'd')} - ${format(fim, 'd')} de ${format(fim, 'MMMM', { locale: ptBR })}`;
    }
    return `${format(inicio, 'd MMM', { locale: ptBR })} - ${format(fim, 'd MMM', { locale: ptBR })}`;
  }, [currentDate, diasSemana]);

  return (
    <div className="elegant-card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex items-center justify-between flex-wrap gap-3 sticky top-0 bg-card z-10">
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
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Days Header */}
          <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b border-border/50 bg-card">
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

          {/* Time Grid */}
          <div className="grid grid-cols-[50px_repeat(7,1fr)]">
            {/* Hours Column */}
            <div className="flex flex-col">
              {slotsHorarios.map((slot, index) => (
                <div 
                  key={`${slot.hora}-${slot.minuto}`} 
                  className="h-[50px] flex items-start justify-end pr-2"
                >
                  <span className="text-[10px] text-muted-foreground -mt-1">
                    {slot.label}
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
              
              // Calcula posição da linha do tempo atual baseado nos slots (em pixels)
              let timeLinePositionPx = -1;
              if (isWithinSchedule) {
                const currentMinutos = currentHour * 60 + currentMinute;
                for (let i = 0; i < slotsHorarios.length; i++) {
                  const slot = slotsHorarios[i];
                  const slotMinutos = slot.hora * 60 + slot.minuto;
                  const proximoSlot = slotsHorarios[i + 1];
                  const proximoMinutos = proximoSlot 
                    ? proximoSlot.hora * 60 + proximoSlot.minuto 
                    : slotMinutos + 60;
                  
                  if (currentMinutos >= slotMinutos && currentMinutos < proximoMinutos) {
                    const offset = (currentMinutos - slotMinutos) / (proximoMinutos - slotMinutos);
                    timeLinePositionPx = (i + offset) * SLOT_HEIGHT;
                    break;
                  }
                }
              }
              
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
                  {slotsHorarios.map((slot) => (
                    <div 
                      key={`${slot.hora}-${slot.minuto}`} 
                      className="h-[50px] border-b border-border/20 hover:bg-secondary/30 transition-colors"
                    />
                  ))}
                  
                  {/* Current time line */}
                  {showCurrentTimeLine && timeLinePositionPx >= 0 && (
                    <div 
                      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                      style={{ top: `${timeLinePositionPx}px` }}
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
                              style={{ 
                                top: pos.top, 
                                height: pos.height, 
                                minHeight: '36px' 
                              }}
                            >
                              <div className={cn("text-[10px] font-medium truncate", cores.text)}>
                                {ag.hora_agendada}
                              </div>
                              <div className="text-[11px] font-semibold text-foreground truncate">
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
