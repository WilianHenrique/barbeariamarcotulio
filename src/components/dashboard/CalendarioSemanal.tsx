import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, addWeeks, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, addHours, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface CalendarioSemanalProps {
  agendamentos: Agendamento[];
  onNovoAgendamento: () => void;
  onSelecionarAgendamento?: (agendamento: Agendamento) => void;
}

// Cores para diferentes agendamentos (ciclo de cores)
const CORES_AGENDAMENTOS = [
  { bg: "bg-cyan-400/90", text: "text-cyan-950", border: "border-cyan-500" },
  { bg: "bg-amber-400/90", text: "text-amber-950", border: "border-amber-500" },
  { bg: "bg-rose-400/90", text: "text-rose-950", border: "border-rose-500" },
  { bg: "bg-emerald-400/90", text: "text-emerald-950", border: "border-emerald-500" },
  { bg: "bg-violet-400/90", text: "text-violet-950", border: "border-violet-500" },
  { bg: "bg-sky-400/90", text: "text-sky-950", border: "border-sky-500" },
  { bg: "bg-orange-400/90", text: "text-orange-950", border: "border-orange-500" },
  { bg: "bg-pink-400/90", text: "text-pink-950", border: "border-pink-500" },
];

const HORARIOS = Array.from({ length: 13 }, (_, i) => 8 + i); // 08:00 até 20:00

export const CalendarioSemanal = ({ 
  agendamentos, 
  onNovoAgendamento,
  onSelecionarAgendamento 
}: CalendarioSemanalProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Mapa de cores para clientes (mantém cor consistente para mesmo cliente)
  const clienteCorMap = useMemo(() => {
    const map = new Map<string, typeof CORES_AGENDAMENTOS[0]>();
    let corIndex = 0;
    agendamentos.forEach(ag => {
      if (!map.has(ag.nome_cliente)) {
        map.set(ag.nome_cliente, CORES_AGENDAMENTOS[corIndex % CORES_AGENDAMENTOS.length]);
        corIndex++;
      }
    });
    return map;
  }, [agendamentos]);

  const navegarSemana = (direcao: 'prev' | 'next') => {
    setCurrentDate(prev => addWeeks(prev, direcao === 'next' ? 1 : -1));
  };

  const irParaHoje = () => {
    setCurrentDate(new Date());
  };

  const diasSemana = useMemo(() => {
    const inicio = startOfWeek(currentDate, { weekStartsOn: 0 }); // Domingo
    const fim = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: inicio, end: fim });
  }, [currentDate]);

  const getAgendamentosDia = (dia: Date) => {
    return agendamentos.filter(ag => isSameDay(new Date(ag.datetime_start), dia));
  };

  // Calcula posição e altura do agendamento baseado no horário
  const calcularPosicaoAgendamento = (agendamento: Agendamento) => {
    const inicio = new Date(agendamento.datetime_start);
    const horaInicio = inicio.getHours();
    const minutoInicio = inicio.getMinutes();
    
    // Posição do topo (relativo a 08:00)
    const topPercent = ((horaInicio - 8) * 60 + minutoInicio) / (12 * 60) * 100;
    
    // Altura baseada na duração
    const heightPercent = (agendamento.tempo_total_minutos / (12 * 60)) * 100;
    
    return { top: `${topPercent}%`, height: `${Math.max(heightPercent, 5)}%` };
  };

  const rangeLabel = useMemo(() => {
    const inicio = startOfWeek(currentDate, { weekStartsOn: 0 });
    const fim = endOfWeek(currentDate, { weekStartsOn: 0 });
    return `${format(inicio, 'dd/MM')} - ${format(fim, 'dd/MM')}`;
  }, [currentDate]);

  return (
    <Card className="barber-card border-primary/20">
      <CardHeader className="border-b border-primary/10 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-xl font-display text-primary">
            Agenda
          </CardTitle>
          
          <div className="flex items-center gap-3">
            {/* Navegação */}
            <div className="flex items-center gap-2 bg-secondary/30 rounded-lg p-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navegarSemana('prev')}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium text-foreground px-2 min-w-[100px] text-center">
                {rangeLabel}
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navegarSemana('next')}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={irParaHoje}
              className="border-primary/30 hover:bg-primary/10"
            >
              Hoje
            </Button>

            <Button 
              onClick={onNovoAgendamento}
              className="barber-button-primary"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Cabeçalho com dias da semana */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
              <div className="p-2 text-center text-sm text-muted-foreground border-r border-border">
                Horário
              </div>
              {diasSemana.map((dia) => (
                <div 
                  key={dia.toISOString()} 
                  className={`p-3 text-center border-r border-border last:border-r-0 ${
                    isToday(dia) ? 'bg-primary/10' : ''
                  }`}
                >
                  <span className="text-xs text-muted-foreground block uppercase">
                    {format(dia, 'EEE', { locale: ptBR })}
                  </span>
                  <span className={`text-xl font-bold block ${
                    isToday(dia) 
                      ? 'bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto' 
                      : 'text-foreground'
                  }`}>
                    {format(dia, 'd')}
                  </span>
                </div>
              ))}
            </div>

            {/* Grade de horários */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)]">
              {/* Coluna de horários */}
              <div className="border-r border-border">
                {HORARIOS.map((hora) => (
                  <div 
                    key={hora} 
                    className="h-16 border-b border-border flex items-start justify-center pt-1"
                  >
                    <span className="text-xs text-muted-foreground">
                      {hora.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
              </div>

              {/* Colunas de dias */}
              {diasSemana.map((dia) => {
                const agendamentosDia = getAgendamentosDia(dia);
                const isPast = isBefore(startOfDay(dia), startOfDay(new Date()));
                
                return (
                  <div 
                    key={dia.toISOString()} 
                    className={`relative border-r border-border last:border-r-0 ${
                      isPast ? 'bg-muted/20' : isToday(dia) ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Grid de horários */}
                    {HORARIOS.map((hora) => (
                      <div 
                        key={hora} 
                        className="h-16 border-b border-border/50 hover:bg-primary/5 transition-colors"
                      />
                    ))}
                    
                    {/* Agendamentos */}
                    <div className="absolute inset-0 pointer-events-none">
                      {agendamentosDia.map((ag) => {
                        const pos = calcularPosicaoAgendamento(ag);
                        const cores = clienteCorMap.get(ag.nome_cliente) || CORES_AGENDAMENTOS[0];
                        
                        return (
                          <div
                            key={ag.id}
                            onClick={() => onSelecionarAgendamento?.(ag)}
                            className={`absolute left-1 right-1 ${cores.bg} ${cores.text} ${cores.border} border-l-4 rounded-md px-2 py-1 overflow-hidden cursor-pointer pointer-events-auto hover:shadow-lg transition-shadow`}
                            style={{ top: pos.top, height: pos.height, minHeight: '40px' }}
                          >
                            <div className="text-xs font-semibold truncate">
                              {ag.hora_agendada} - {ag.hora_final}
                            </div>
                            <div className="text-sm font-bold truncate">
                              {ag.nome_cliente}
                            </div>
                            <div className="text-xs truncate opacity-80">
                              {ag.servico}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
