import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar, Clock, User, Scissors, CheckCircle2, CalendarDays, CalendarRange, LayoutGrid, ChevronLeft, ChevronRight, Repeat, Phone, Pencil, Search } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addWeeks, addMonths, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClienteSugestao {
  nome_cliente: string;
  telefone_cliente: string | null;
}

interface Agendamento {
  id: string;
  datetime_start: string;
  datetime_end: string;
  dia_agendado: string;
  hora_agendada: string;
  hora_final: string;
  servico: string;
  tempo_total_minutos: number;
}

const SERVICOS = [
  { id: "barba", nome: "Barba", tempoSugerido: 30 },
  { id: "cabelo", nome: "Cabelo", tempoSugerido: 45 },
  { id: "sobrancelha", nome: "Sobrancelha", tempoSugerido: 15 },
  { id: "barba_cabelo", nome: "Barba + Cabelo", tempoSugerido: 60 },
  { id: "pezinho", nome: "Pezinho", tempoSugerido: 15 },
  { id: "barba_cabelo_sobrancelha", nome: "Barba + Cabelo + Sobrancelha", tempoSugerido: 75 },
];

const HORARIOS_TRABALHO = {
  inicio: 8,
  fim: 20,
  intervalo: 30, // minutos
};

type ViewMode = "day" | "week" | "month";
type RecorrenciaType = "unico" | "semanal" | "mensal" | "personalizado";

interface NovoAgendamentoProps {
  onAgendamentoCriado: () => void;
  agendamentosExistentes: Agendamento[];
}

export const NovoAgendamento = ({ onAgendamentoCriado, agendamentosExistentes }: NovoAgendamentoProps) => {
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefoneCliente, setTelefoneCliente] = useState("");
  const [telefoneEditavel, setTelefoneEditavel] = useState(true);
  const [clientesSugestoes, setClientesSugestoes] = useState<ClienteSugestao[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [servicoSelecionado, setServicoSelecionado] = useState<string | null>(null);
  const [tempoServico, setTempoServico] = useState(30);
  const [dataSelecionada, setDataSelecionada] = useState<Date>(new Date());
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tipoRecorrencia, setTipoRecorrencia] = useState<RecorrenciaType>("unico");
  const [recorrenciaPersonalizada, setRecorrenciaPersonalizada] = useState(2); // semanas
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [diasMesRecorrentes, setDiasMesRecorrentes] = useState<number[]>([]);
  const [diasMesTexto, setDiasMesTexto] = useState("");
  const [showConfirmacao, setShowConfirmacao] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const sugestoesRef = useRef<HTMLDivElement>(null);

  // Atualiza tempo sugerido quando seleciona serviço
  useEffect(() => {
    if (servicoSelecionado) {
      const servico = SERVICOS.find(s => s.id === servicoSelecionado);
      if (servico) {
        setTempoServico(servico.tempoSugerido);
      }
    }
  }, [servicoSelecionado]);

  // Buscar clientes conforme digita
  useEffect(() => {
    const buscarClientes = async () => {
      if (nomeCliente.length < 2) {
        setClientesSugestoes([]);
        setShowSugestoes(false);
        return;
      }

      setBuscandoClientes(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('agendamentos')
          .select('nome_cliente, telefone_cliente')
          .eq('user_id', user.id)
          .ilike('nome_cliente', `%${nomeCliente}%`)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Remover duplicatas baseado no nome
        const clientesUnicos = data?.reduce((acc: ClienteSugestao[], curr) => {
          const existe = acc.find(c => c.nome_cliente.toLowerCase() === curr.nome_cliente.toLowerCase());
          if (!existe) {
            acc.push({
              nome_cliente: curr.nome_cliente,
              telefone_cliente: curr.telefone_cliente
            });
          }
          return acc;
        }, []) || [];

        setClientesSugestoes(clientesUnicos);
        setShowSugestoes(clientesUnicos.length > 0);
      } catch (error) {
        console.error('Erro ao buscar clientes:', error);
      } finally {
        setBuscandoClientes(false);
      }
    };

    const debounce = setTimeout(buscarClientes, 300);
    return () => clearTimeout(debounce);
  }, [nomeCliente]);

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sugestoesRef.current && !sugestoesRef.current.contains(event.target as Node)) {
        setShowSugestoes(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Selecionar cliente da lista
  const selecionarCliente = (cliente: ClienteSugestao) => {
    setNomeCliente(cliente.nome_cliente);
    setTelefoneCliente(cliente.telefone_cliente || '');
    setTelefoneEditavel(!cliente.telefone_cliente);
    setShowSugestoes(false);
  };

  // Gera horários disponíveis para um dia
  const gerarHorariosDisponiveis = (data: Date) => {
    const horarios: string[] = [];
    for (let hora = HORARIOS_TRABALHO.inicio; hora < HORARIOS_TRABALHO.fim; hora++) {
      for (let minuto = 0; minuto < 60; minuto += HORARIOS_TRABALHO.intervalo) {
        const horaFormatada = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
        horarios.push(horaFormatada);
      }
    }
    return horarios;
  };

  // Verifica se horário está ocupado
  const isHorarioOcupado = (data: Date, horario: string) => {
    const [hora, minuto] = horario.split(':').map(Number);
    const inicioNovo = new Date(data);
    inicioNovo.setHours(hora, minuto, 0, 0);
    const fimNovo = new Date(inicioNovo.getTime() + tempoServico * 60 * 1000);

    return agendamentosExistentes.some(ag => {
      const inicioExistente = new Date(ag.datetime_start);
      const fimExistente = new Date(ag.datetime_end);
      
      return (
        isSameDay(inicioExistente, data) &&
        ((inicioNovo >= inicioExistente && inicioNovo < fimExistente) ||
         (fimNovo > inicioExistente && fimNovo <= fimExistente) ||
         (inicioNovo <= inicioExistente && fimNovo >= fimExistente))
      );
    });
  };

  // Verifica se horário já passou
  const isHorarioPassado = (data: Date, horario: string) => {
    const [hora, minuto] = horario.split(':').map(Number);
    const dataHorario = new Date(data);
    dataHorario.setHours(hora, minuto, 0, 0);
    return isBefore(dataHorario, new Date());
  };

  // Navegação do calendário
  const navegarCalendario = (direcao: 'prev' | 'next') => {
    if (viewMode === 'day') {
      setCurrentDate(prev => addDays(prev, direcao === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      setCurrentDate(prev => addWeeks(prev, direcao === 'next' ? 1 : -1));
    } else {
      setCurrentDate(prev => addMonths(prev, direcao === 'next' ? 1 : -1));
    }
  };

  // Dias a exibir baseado no modo
  const getDiasExibidos = () => {
    if (viewMode === 'day') {
      return [currentDate];
    } else if (viewMode === 'week') {
      const inicio = startOfWeek(currentDate, { weekStartsOn: 1 });
      const fim = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: inicio, end: fim });
    } else {
      const inicio = startOfMonth(currentDate);
      const fim = endOfMonth(currentDate);
      return eachDayOfInterval({ start: inicio, end: fim });
    }
  };

  // Conta agendamentos por dia
  const getAgendamentosDia = (data: Date) => {
    return agendamentosExistentes.filter(ag => 
      isSameDay(new Date(ag.datetime_start), data)
    ).length;
  };

  // Criar agendamento
  const criarAgendamento = async () => {
    if (!nomeCliente || !servicoSelecionado || !horarioSelecionado) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const servico = SERVICOS.find(s => s.id === servicoSelecionado);
      const datasParaAgendar: Date[] = [];
      
      // Calcular datas baseado na recorrência
      if (tipoRecorrencia === 'unico') {
        datasParaAgendar.push(dataSelecionada);
      } else if (tipoRecorrencia === 'semanal') {
        // Toda semana no mesmo dia por 4 ocorrências
        for (let i = 0; i < 4; i++) {
          datasParaAgendar.push(addWeeks(dataSelecionada, i));
        }
      } else if (tipoRecorrencia === 'mensal') {
        // Dias fixos no mês (ex: 1 e 15). Se não informar, usa o dia da data selecionada
        const diaBase = dataSelecionada.getDate();
        const diasDoMes = diasMesRecorrentes.length > 0 ? diasMesRecorrentes : [diaBase];
        const quantidadeMeses = 3;

        for (let i = 0; i < quantidadeMeses; i++) {
          const dataMesBase = addMonths(startOfDay(dataSelecionada), i);
          const ultimoDiaMes = endOfMonth(dataMesBase).getDate();

          diasDoMes.forEach((dia) => {
            const diaValido = Math.min(Math.max(dia, 1), ultimoDiaMes);
            const dataMes = new Date(dataMesBase);
            dataMes.setDate(diaValido);
            datasParaAgendar.push(dataMes);
          });
        }
      } else {
        // Personalizado - a cada X semanas por 4 vezes
        for (let i = 0; i < 4; i++) {
          datasParaAgendar.push(addWeeks(dataSelecionada, i * recorrenciaPersonalizada));
        }
      }

      const [hora, minuto] = horarioSelecionado.split(':').map(Number);

      const agendamentos = datasParaAgendar.map(data => {
        const datetimeStart = new Date(data);
        datetimeStart.setHours(hora, minuto, 0, 0);
        
        const datetimeEnd = new Date(datetimeStart.getTime() + tempoServico * 60 * 1000);
        
        return {
          user_id: user.id,
          nome_cliente: nomeCliente,
          telefone_cliente: telefoneCliente || null,
          servico: servico?.nome || '',
          datetime_start: datetimeStart.toISOString(),
          datetime_end: datetimeEnd.toISOString(),
          dia_agendado: format(data, 'yyyy-MM-dd'),
          dia_agendado_formatado: format(data, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
          hora_agendada: horarioSelecionado,
          hora_final: format(datetimeEnd, 'HH:mm'),
          tempo_total_minutos: tempoServico,
          evento_recorrente: tipoRecorrencia !== 'unico' ? 'Sim' : 'Não',
          status_evento: 'confirmado',
          link_evento: '',
          id_evento: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
      });

      const { error } = await supabase
        .from('agendamentos')
        .insert(agendamentos);

      if (error) throw error;

      toast.success(`${agendamentos.length} agendamento(s) criado(s) com sucesso!`);
      setShowConfirmacao(true);
      
      // Reset form
      setNomeCliente("");
      setTelefoneCliente("");
      setTelefoneEditavel(true);
      setServicoSelecionado(null);
      setHorarioSelecionado(null);
      setTipoRecorrencia("unico");
      setIsRecorrente(false);
      setDiasMesRecorrentes([]);
      setDiasMesTexto("");
      
      onAgendamentoCriado();
    } catch (error: any) {
      toast.error("Erro ao criar agendamento: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const diasExibidos = getDiasExibidos();
  const horariosDisponiveis = gerarHorariosDisponiveis(dataSelecionada);

  return (
    <Card className="barber-card border-primary/20">
      <CardHeader className="border-b border-primary/10">
        <CardTitle className="text-xl font-display text-primary flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Novo Agendamento
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Dados do Cliente */}
        <div className="space-y-4">
          <div className="space-y-2 relative" ref={sugestoesRef}>
            <Label htmlFor="nome" className="text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Nome do Cliente
            </Label>
            <div className="relative">
              <Input
                id="nome"
                value={nomeCliente}
                onChange={(e) => {
                  setNomeCliente(e.target.value);
                  setTelefoneEditavel(true);
                }}
                placeholder="Digite o nome do cliente"
                className="bg-secondary/50 border-border focus:border-primary pr-10"
              />
              {buscandoClientes ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
            </div>
            
            {/* Lista de sugestões */}
            {showSugestoes && clientesSugestoes.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {clientesSugestoes.map((cliente, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selecionarCliente(cliente)}
                    className="w-full px-4 py-3 text-left hover:bg-primary/10 transition-colors flex items-center justify-between border-b border-border last:border-b-0"
                  >
                    <div>
                      <span className="font-medium text-foreground">{cliente.nome_cliente}</span>
                      {cliente.telefone_cliente && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({cliente.telefone_cliente})
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">Cliente existente</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Campo de WhatsApp */}
          <div className="space-y-2">
            <Label htmlFor="telefone" className="text-foreground flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              WhatsApp do Cliente
            </Label>
            <div className="flex gap-2">
              <Input
                id="telefone"
                value={telefoneCliente}
                onChange={(e) => setTelefoneCliente(e.target.value)}
                placeholder="(00) 00000-0000"
                className="bg-secondary/50 border-border focus:border-primary flex-1"
                disabled={!telefoneEditavel}
              />
              {!telefoneEditavel && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setTelefoneEditavel(true)}
                  className="shrink-0"
                  title="Editar número"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
            {!telefoneEditavel && (
              <p className="text-xs text-muted-foreground">
                Número já cadastrado. Clique no lápis para editar.
              </p>
            )}
          </div>
        </div>

        {/* Seleção de Serviço */}
        <div className="space-y-3">
          <Label className="text-foreground flex items-center gap-2">
            <Scissors className="h-4 w-4 text-primary" />
            Serviço Desejado
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {SERVICOS.map((servico) => (
              <button
                key={servico.id}
                onClick={() => setServicoSelecionado(servico.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  servicoSelecionado === servico.id
                    ? 'border-primary bg-primary/10 shadow-glow'
                    : 'border-border bg-secondary/30 hover:border-primary/50'
                }`}
              >
                <span className="font-medium text-foreground block">{servico.nome}</span>
                <span className="text-sm text-muted-foreground">{servico.tempoSugerido} min</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tempo do Serviço */}
        <div className="space-y-2">
          <Label htmlFor="tempo" className="text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Tempo do Procedimento (minutos)
          </Label>
          <Input
            id="tempo"
            type="number"
            min={15}
            step={15}
            value={tempoServico}
            onChange={(e) => setTempoServico(Number(e.target.value))}
            className="bg-secondary/50 border-border focus:border-primary w-32"
          />
        </div>

        {/* Calendário */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Selecione a Data e Horário
            </Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('day')}
                className={viewMode === 'day' ? 'bg-primary text-primary-foreground' : ''}
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('week')}
                className={viewMode === 'week' ? 'bg-primary text-primary-foreground' : ''}
              >
                <CalendarRange className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('month')}
                className={viewMode === 'month' ? 'bg-primary text-primary-foreground' : ''}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Navegação */}
          <div className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
            <Button variant="ghost" size="sm" onClick={() => navegarCalendario('prev')}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="font-display text-lg text-primary">
              {viewMode === 'day' && format(currentDate, "dd 'de' MMMM", { locale: ptBR })}
              {viewMode === 'week' && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM')}`}
              {viewMode === 'month' && format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="sm" onClick={() => navegarCalendario('next')}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Grade de Dias */}
          <div className={`grid gap-2 ${viewMode === 'month' ? 'grid-cols-7' : viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-1'}`}>
            {viewMode !== 'day' && diasExibidos.map((dia) => (
              <button
                key={dia.toISOString()}
                onClick={() => {
                  if (!isBefore(startOfDay(dia), startOfDay(new Date()))) {
                    setDataSelecionada(dia);
                  }
                }}
                disabled={isBefore(startOfDay(dia), startOfDay(new Date()))}
                className={`p-3 rounded-lg text-center transition-all ${
                  isSameDay(dia, dataSelecionada)
                    ? 'bg-primary text-primary-foreground shadow-glow'
                    : isToday(dia)
                    ? 'bg-accent/20 border border-accent'
                    : isBefore(startOfDay(dia), startOfDay(new Date()))
                    ? 'bg-muted/30 text-muted-foreground cursor-not-allowed'
                    : 'bg-secondary/30 hover:bg-secondary/50'
                }`}
              >
                <span className="text-xs block">
                  {format(dia, 'EEE', { locale: ptBR })}
                </span>
                <span className="text-lg font-bold block">{format(dia, 'd')}</span>
                {getAgendamentosDia(dia) > 0 && (
                  <Badge variant="outline" className="text-xs mt-1">
                    {getAgendamentosDia(dia)}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Data selecionada info */}
          <div className="bg-secondary/30 rounded-lg p-3">
            <span className="text-sm text-muted-foreground">Data selecionada: </span>
            <span className="font-medium text-foreground">
              {format(dataSelecionada, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
          </div>

          {/* Grade de Horários */}
          <div className="space-y-2">
            <Label className="text-foreground text-sm">Horários Disponíveis</Label>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-2 bg-secondary/20 rounded-lg">
              {horariosDisponiveis.map((horario) => {
                const ocupado = isHorarioOcupado(dataSelecionada, horario);
                const passado = isHorarioPassado(dataSelecionada, horario);
                const indisponivel = ocupado || passado;
                
                return (
                  <button
                    key={horario}
                    onClick={() => !indisponivel && setHorarioSelecionado(horario)}
                    disabled={indisponivel}
                    className={`py-2 px-3 rounded-md text-sm font-medium transition-all ${
                      horarioSelecionado === horario
                        ? 'bg-primary text-primary-foreground shadow-glow'
                        : indisponivel
                        ? 'bg-muted/30 text-muted-foreground cursor-not-allowed line-through'
                        : 'bg-secondary/50 hover:bg-primary/20 text-foreground'
                    }`}
                  >
                    {horario}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recorrência */}
        <div className="space-y-4 bg-secondary/20 rounded-lg p-4">
          <Label className="text-foreground flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" />
            Tipo de Agendamento
          </Label>
          <RadioGroup value={tipoRecorrencia} onValueChange={(v) => setTipoRecorrencia(v as RecorrenciaType)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="unico" id="unico" />
              <Label htmlFor="unico" className="text-foreground cursor-pointer">Único (apenas uma vez)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="semanal" id="semanal" />
              <Label htmlFor="semanal" className="text-foreground cursor-pointer">Semanal (4 semanas)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="mensal" id="mensal" />
              <Label htmlFor="mensal" className="text-foreground cursor-pointer">Mensal (3 meses)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="personalizado" id="personalizado" />
              <Label htmlFor="personalizado" className="text-foreground cursor-pointer">Personalizado</Label>
            </div>
          </RadioGroup>

          {tipoRecorrencia === 'personalizado' && (
            <div className="flex items-center gap-3 mt-3 pl-6">
              <span className="text-muted-foreground">A cada</span>
              <Select value={recorrenciaPersonalizada.toString()} onValueChange={(v) => setRecorrenciaPersonalizada(Number(v))}>
                <SelectTrigger className="w-20 bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">semana(s) - 4 vezes</span>
            </div>
          )}
        </div>

        {/* Resumo */}
        {servicoSelecionado && horarioSelecionado && nomeCliente && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 space-y-2">
            <h4 className="font-display text-primary">Resumo do Agendamento</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="text-foreground">{nomeCliente}</span>
              <span className="text-muted-foreground">Serviço:</span>
              <span className="text-foreground">{SERVICOS.find(s => s.id === servicoSelecionado)?.nome}</span>
              <span className="text-muted-foreground">Data:</span>
              <span className="text-foreground">{format(dataSelecionada, "dd/MM/yyyy", { locale: ptBR })}</span>
              <span className="text-muted-foreground">Horário:</span>
              <span className="text-foreground">{horarioSelecionado}</span>
              <span className="text-muted-foreground">Duração:</span>
              <span className="text-foreground">{tempoServico} minutos</span>
              <span className="text-muted-foreground">Recorrência:</span>
              <span className="text-foreground">
                {tipoRecorrencia === 'unico' && 'Único'}
                {tipoRecorrencia === 'semanal' && 'Semanal (4x)'}
                {tipoRecorrencia === 'mensal' && 'Mensal (3x)'}
                {tipoRecorrencia === 'personalizado' && `A cada ${recorrenciaPersonalizada} semanas (4x)`}
              </span>
            </div>
          </div>
        )}

        {/* Botão de Agendar */}
        <Button 
          onClick={criarAgendamento} 
          disabled={!servicoSelecionado || !horarioSelecionado || !nomeCliente || isLoading}
          className="w-full barber-button-primary"
        >
          {isLoading ? 'Agendando...' : 'Confirmar Agendamento'}
        </Button>

        {/* Dialog de Confirmação */}
        <Dialog open={showConfirmacao} onOpenChange={setShowConfirmacao}>
          <DialogContent className="bg-card border-primary/20">
            <DialogHeader>
              <DialogTitle className="font-display text-primary flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                Agendamento Confirmado!
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                O agendamento foi criado com sucesso e o cliente receberá as notificações de lembrete.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => setShowConfirmacao(false)} className="w-full barber-button-primary">
              Fechar
            </Button>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
