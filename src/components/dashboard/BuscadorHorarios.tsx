import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Calendar as CalendarIcon, Clock, Search } from "lucide-react";
import { format, addMinutes, isBefore, isAfter, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Agendamento {
  id: string;
  datetime_start: string;
  datetime_end: string;
  tempo_total_minutos: number;
  servico: string;
}

interface BuscadorHorariosProps {
  agendamentos: Agendamento[];
  onSelecionarHorario?: (data: Date, horario: string) => void;
}

interface HorarioDisponivel {
  inicio: Date;
  fim: Date;
  label: string;
}

// Serviços pré-definidos com tempos
const SERVICOS_PADRAO = [
  { nome: "Corte de Cabelo", minutos: 30 },
  { nome: "Barba", minutos: 20 },
  { nome: "Corte + Barba", minutos: 50 },
  { nome: "Hidratação", minutos: 40 },
  { nome: "Pezinho", minutos: 15 },
  { nome: "Sobrancelha", minutos: 10 },
];

export function BuscadorHorarios({ agendamentos, onSelecionarHorario }: BuscadorHorariosProps) {
  const [dataSelecionada, setDataSelecionada] = useState<Date>(new Date());
  const [servicoSelecionado, setServicoSelecionado] = useState<string>("");
  const [tempoCustomizado, setTempoCustomizado] = useState<string>("");
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [filtrosAtivos, setFiltrosAtivos] = useState<{
    data: Date | null;
    tempoMinutos: number | null;
  } | null>(null);

  // Horário comercial (8h às 20h)
  const HORA_INICIO = 8;
  const HORA_FIM = 20;
  const INTERVALO_MINUTOS = 30;

  // Calcula o tempo necessário (apenas para exibição e preparação do filtro)
  const tempoNecessario = useMemo(() => {
    if (tempoCustomizado && parseInt(tempoCustomizado) > 0) {
      return parseInt(tempoCustomizado);
    }
    if (servicoSelecionado) {
      const servico = SERVICOS_PADRAO.find((s) => s.nome === servicoSelecionado);
      return servico?.minutos || 30;
    }
    return 30; // padrão
  }, [servicoSelecionado, tempoCustomizado]);

  // Busca horários disponíveis apenas quando o usuário clicar em "Buscar Horários"
  const horariosDisponiveis = useMemo((): HorarioDisponivel[] => {
    if (!filtrosAtivos || !filtrosAtivos.data || !filtrosAtivos.tempoMinutos) return [];

    const dataBase = filtrosAtivos.data;
    const duracaoMinutos = filtrosAtivos.tempoMinutos;

    const resultado: HorarioDisponivel[] = [];
    const diaInicio = startOfDay(dataBase);

    // Agendamentos do dia selecionado nos filtros
    const agendamentosDoDia = agendamentos
      .filter((a) => {
        const dataAgendamento = startOfDay(parseISO(a.datetime_start));
        return dataAgendamento.getTime() === diaInicio.getTime();
      })
      .sort(
        (a, b) =>
          parseISO(a.datetime_start).getTime() - parseISO(b.datetime_start).getTime()
      );

    // Gera todos os slots possíveis do dia
    const totalSlots = ((HORA_FIM - HORA_INICIO) * 60) / INTERVALO_MINUTOS;

    for (let i = 0; i < totalSlots; i++) {
      const minutosDoInicio = HORA_INICIO * 60 + i * INTERVALO_MINUTOS;
      const horaAtual = Math.floor(minutosDoInicio / 60);
      const minutoAtual = minutosDoInicio % 60;

      const inicioSlot = new Date(dataBase);
      inicioSlot.setHours(horaAtual, minutoAtual, 0, 0);

      const fimSlot = addMinutes(inicioSlot, duracaoMinutos);

      // Verifica se o slot ultrapassa o horário comercial
      if (
        fimSlot.getHours() > HORA_FIM ||
        (fimSlot.getHours() === HORA_FIM && fimSlot.getMinutes() > 0)
      ) {
        continue;
      }

      // Verifica se já passou (apenas para hoje)
      const agora = new Date();
      if (startOfDay(dataBase).getTime() === startOfDay(agora).getTime()) {
        if (isBefore(inicioSlot, agora)) {
          continue;
        }
      }

      // Verifica conflitos com agendamentos existentes
      const temConflito = agendamentosDoDia.some((agendamento) => {
        const agendamentoInicio = parseISO(agendamento.datetime_start);
        const agendamentoFim = parseISO(agendamento.datetime_end);

        // Verifica se há sobreposição
        return (
          (inicioSlot >= agendamentoInicio && inicioSlot < agendamentoFim) ||
          (fimSlot > agendamentoInicio && fimSlot <= agendamentoFim) ||
          (inicioSlot <= agendamentoInicio && fimSlot >= agendamentoFim)
        );
      });

      if (!temConflito) {
        resultado.push({
          inicio: inicioSlot,
          fim: fimSlot,
          label: `${format(inicioSlot, "HH:mm")} - ${format(fimSlot, "HH:mm")}`,
        });
      }
    }

    return resultado;
  }, [filtrosAtivos, agendamentos, HORA_FIM, HORA_INICIO, INTERVALO_MINUTOS]);

  const handleBuscar = () => {
    setFiltrosAtivos({
      data: dataSelecionada,
      tempoMinutos: tempoNecessario,
    });
    setMostrarResultados(true);
  };

  const handleSelecionarHorario = (horario: HorarioDisponivel) => {
    if (onSelecionarHorario) {
      onSelecionarHorario(horario.inicio, horario.label);
    }
  };

  return (
    <Card className="elegant-card p-6 space-y-6">
      <div>
        <h3 className="font-display text-lg text-foreground mb-1">Buscar Horários Disponíveis</h3>
        <p className="text-sm text-muted-foreground">
          Encontre os melhores horários para seus clientes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Data */}
        <div className="space-y-2">
          <Label>Data</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dataSelecionada && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dataSelecionada ? format(dataSelecionada, "dd 'de' MMMM", { locale: ptBR }) : "Selecione"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dataSelecionada}
                onSelect={(date) => date && setDataSelecionada(date)}
                disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Serviço */}
        <div className="space-y-2">
          <Label>Serviço</Label>
          <Select value={servicoSelecionado} onValueChange={(value) => {
            setServicoSelecionado(value);
            setTempoCustomizado("");
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o serviço" />
            </SelectTrigger>
            <SelectContent>
              {SERVICOS_PADRAO.map((servico) => (
                <SelectItem key={servico.nome} value={servico.nome}>
                  {servico.nome} ({servico.minutos} min)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tempo Customizado */}
        <div className="space-y-2">
          <Label>Ou tempo customizado (min)</Label>
          <Input
            type="number"
            min="10"
            max="180"
            placeholder="Ex: 45"
            value={tempoCustomizado}
            onChange={(e) => {
              setTempoCustomizado(e.target.value);
              setServicoSelecionado("");
            }}
          />
        </div>
      </div>

      <Button onClick={handleBuscar} className="w-full btn-primary">
        <Search className="w-4 h-4 mr-2" />
        Buscar Horários
      </Button>

      {/* Resultados */}
      {mostrarResultados && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">
              {horariosDisponiveis.length} horário
              {horariosDisponiveis.length !== 1 ? "s" : ""} disponível
              {horariosDisponiveis.length !== 1 ? "eis" : ""}
            </h4>
            <span className="text-sm text-muted-foreground">
              Duração: {filtrosAtivos?.tempoMinutos ?? tempoNecessario} min
            </span>
          </div>

          {horariosDisponiveis.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum horário disponível para este dia</p>
              <p className="text-sm mt-1">Tente outra data ou duração menor</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
              {horariosDisponiveis.map((horario, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => handleSelecionarHorario(horario)}
                >
                  <Clock className="w-3 h-3 mr-1.5" />
                  {format(horario.inicio, 'HH:mm')}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
