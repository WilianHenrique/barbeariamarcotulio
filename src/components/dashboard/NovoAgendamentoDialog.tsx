import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar, Clock, User, Scissors, CheckCircle2, Repeat, Phone, Pencil, Search } from "lucide-react";
import { format, addDays, addWeeks, addMonths, isSameDay, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

interface Servico {
  id: string;
  nome: string;
  duracao_minutos: number;
  ativo: boolean;
  ordem: number;
}

const HORARIOS_TRABALHO = {
  inicio: 8,
  fim: 20,
  intervalo: 15,
};

type RecorrenciaType = "unico" | "semanal" | "mensal" | "personalizado";

interface NovoAgendamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgendamentoCriado: () => void;
  agendamentosExistentes: Agendamento[];
  dataSelecionadaInicial?: Date;
}

// Máscara de telefone
const formatarTelefone = (value: string) => {
  const numeros = value.replace(/\D/g, '');
  
  if (numeros.length <= 2) {
    return numeros.length > 0 ? `(${numeros}` : '';
  } else if (numeros.length <= 3) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  } else if (numeros.length <= 7) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 3)} ${numeros.slice(3)}`;
  } else if (numeros.length <= 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 3)} ${numeros.slice(3, 7)}-${numeros.slice(7)}`;
  }
  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 3)} ${numeros.slice(3, 7)}-${numeros.slice(7, 11)}`;
};

const validarTelefone = (telefone: string) => {
  const numeros = telefone.replace(/\D/g, '');
  return numeros.length === 11;
};

export const NovoAgendamentoDialog = ({ 
  open, 
  onOpenChange, 
  onAgendamentoCriado, 
  agendamentosExistentes,
  dataSelecionadaInicial
}: NovoAgendamentoDialogProps) => {
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefoneCliente, setTelefoneCliente] = useState("");
  const [telefoneEditavel, setTelefoneEditavel] = useState(true);
  const [telefoneErro, setTelefoneErro] = useState("");
  const [clientesSugestoes, setClientesSugestoes] = useState<ClienteSugestao[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [servicoSelecionado, setServicoSelecionado] = useState<string | null>(null);
  const [tempoServico, setTempoServico] = useState(30);
  const [dataSelecionada, setDataSelecionada] = useState<Date>(dataSelecionadaInicial || new Date());
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [tipoRecorrencia, setTipoRecorrencia] = useState<RecorrenciaType>("unico");
  const [recorrenciaPersonalizada, setRecorrenciaPersonalizada] = useState(2);
  const [showConfirmacao, setShowConfirmacao] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const sugestoesRef = useRef<HTMLDivElement>(null);

  // Carregar serviços do banco de dados
  useEffect(() => {
    const carregarServicos = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('servicos')
          .select('*')
          .eq('user_id', user.id)
          .eq('ativo', true)
          .order('ordem');

        if (error) throw error;
        setServicos(data || []);
      } catch (error) {
        console.error('Erro ao carregar serviços:', error);
      }
    };

    carregarServicos();
  }, []);

  // Reset form quando abre
  useEffect(() => {
    if (open) {
      setNomeCliente("");
      setTelefoneCliente("");
      setTelefoneEditavel(true);
      setTelefoneErro("");
      setServicoSelecionado(null);
      setHorarioSelecionado(null);
      setTipoRecorrencia("unico");
      if (dataSelecionadaInicial) {
        setDataSelecionada(dataSelecionadaInicial);
      }
    }
  }, [open, dataSelecionadaInicial]);

  // Atualiza tempo sugerido quando seleciona serviço
  useEffect(() => {
    if (servicoSelecionado) {
      const servico = servicos.find(s => s.id === servicoSelecionado);
      if (servico) {
        setTempoServico(servico.duracao_minutos);
      }
    }
  }, [servicoSelecionado, servicos]);

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

  const selecionarCliente = (cliente: ClienteSugestao) => {
    setNomeCliente(cliente.nome_cliente);
    setTelefoneCliente(cliente.telefone_cliente ? formatarTelefone(cliente.telefone_cliente) : '');
    setTelefoneEditavel(!cliente.telefone_cliente);
    setTelefoneErro("");
    setShowSugestoes(false);
  };

  const handleTelefoneChange = (value: string) => {
    const formatted = formatarTelefone(value);
    setTelefoneCliente(formatted);
    
    if (formatted && !validarTelefone(formatted)) {
      setTelefoneErro("Formato: (xx) x xxxx-xxxx");
    } else {
      setTelefoneErro("");
    }
  };

  const gerarHorariosDisponiveis = () => {
    const horarios: string[] = [];
    for (let hora = HORARIOS_TRABALHO.inicio; hora < HORARIOS_TRABALHO.fim; hora++) {
      for (let minuto = 0; minuto < 60; minuto += HORARIOS_TRABALHO.intervalo) {
        const horaFormatada = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
        horarios.push(horaFormatada);
      }
    }
    return horarios;
  };

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

  const isHorarioPassado = (data: Date, horario: string) => {
    const [hora, minuto] = horario.split(':').map(Number);
    const dataHorario = new Date(data);
    dataHorario.setHours(hora, minuto, 0, 0);
    return isBefore(dataHorario, new Date());
  };

  const criarAgendamento = async () => {
    if (!nomeCliente || !servicoSelecionado || !horarioSelecionado) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (telefoneCliente && !validarTelefone(telefoneCliente)) {
      toast.error("Número de WhatsApp inválido");
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const servico = servicos.find(s => s.id === servicoSelecionado);
      const datasParaAgendar: Date[] = [];
      
      if (tipoRecorrencia === 'unico') {
        datasParaAgendar.push(dataSelecionada);
      } else if (tipoRecorrencia === 'semanal') {
        for (let i = 0; i < 4; i++) {
          datasParaAgendar.push(addWeeks(dataSelecionada, i));
        }
      } else if (tipoRecorrencia === 'mensal') {
        for (let i = 0; i < 3; i++) {
          datasParaAgendar.push(addMonths(dataSelecionada, i));
        }
      } else {
        for (let i = 0; i < 4; i++) {
          datasParaAgendar.push(addWeeks(dataSelecionada, i * recorrenciaPersonalizada));
        }
      }

      const [hora, minuto] = horarioSelecionado.split(':').map(Number);
      const telefoneNumeros = telefoneCliente.replace(/\D/g, '');

      const agendamentos = datasParaAgendar.map(data => {
        const datetimeStart = new Date(data);
        datetimeStart.setHours(hora, minuto, 0, 0);
        
        const datetimeEnd = new Date(datetimeStart.getTime() + tempoServico * 60 * 1000);
        
        return {
          user_id: user.id,
          nome_cliente: nomeCliente,
          telefone_cliente: telefoneNumeros || null,
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
      onAgendamentoCriado();
      
      setTimeout(() => {
        setShowConfirmacao(false);
        onOpenChange(false);
      }, 1500);
    } catch (error: any) {
      toast.error("Erro ao criar agendamento: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const horariosDisponiveis = gerarHorariosDisponiveis();

  if (showConfirmacao) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-primary/20 max-w-md">
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="bg-green-500/20 rounded-full p-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <h3 className="font-display text-xl text-primary">Agendamento Confirmado!</h3>
            <p className="text-muted-foreground text-center">
              O cliente receberá as notificações de lembrete.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-primary/20 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Novo Agendamento
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Preencha os dados do cliente e escolha a data e horário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Nome do Cliente */}
          <div className="space-y-2 relative" ref={sugestoesRef}>
            <Label htmlFor="nome" className="text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Nome do Cliente *
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
                          ({formatarTelefone(cliente.telefone_cliente)})
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">Cliente existente</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* WhatsApp */}
          <div className="space-y-2">
            <Label htmlFor="telefone" className="text-foreground flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              WhatsApp do Cliente
            </Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  id="telefone"
                  value={telefoneCliente}
                  onChange={(e) => handleTelefoneChange(e.target.value)}
                  placeholder="(xx) x xxxx-xxxx"
                  className={cn(
                    "bg-secondary/50 border-border focus:border-primary",
                    telefoneErro && "border-destructive focus:border-destructive"
                  )}
                  disabled={!telefoneEditavel}
                  maxLength={17}
                />
                {telefoneErro && (
                  <p className="text-xs text-destructive mt-1">{telefoneErro}</p>
                )}
              </div>
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
          </div>

          {/* Serviço */}
          <div className="space-y-3">
            <Label className="text-foreground flex items-center gap-2">
              <Scissors className="h-4 w-4 text-primary" />
              Serviço *
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {servicos.length === 0 ? (
                <div className="col-span-2 text-center py-4 text-muted-foreground text-sm">
                  Nenhum serviço cadastrado. Adicione serviços nas Configurações.
                </div>
              ) : (
                servicos.map((servico) => (
                  <button
                    key={servico.id}
                    onClick={() => setServicoSelecionado(servico.id)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      servicoSelecionado === servico.id
                      ? 'border-primary bg-primary/10 shadow-glow'
                      : 'border-border bg-secondary/30 hover:border-primary/50'
                  }`}
                >
                    <span className="font-medium text-foreground block text-sm">{servico.nome}</span>
                    <span className="text-xs text-muted-foreground">{servico.duracao_minutos} min</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Tempo customizado */}
          <div className="space-y-2">
            <Label htmlFor="tempo" className="text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Tempo (minutos)
            </Label>
            <Input
              id="tempo"
              type="number"
              min={15}
              step={15}
              value={tempoServico}
              onChange={(e) => setTempoServico(Number(e.target.value))}
              className="bg-secondary/50 border-border focus:border-primary w-24"
            />
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label className="text-foreground">Data *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-secondary/50 border-border",
                    !dataSelecionada && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dataSelecionada ? format(dataSelecionada, "PPP", { locale: ptBR }) : "Selecione uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dataSelecionada}
                  onSelect={(date) => date && setDataSelecionada(date)}
                  disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Horários */}
          <div className="space-y-2">
            <Label className="text-foreground">Horário *</Label>
            <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto p-2 bg-secondary/20 rounded-lg">
              {horariosDisponiveis.map((horario) => {
                const ocupado = isHorarioOcupado(dataSelecionada, horario);
                const passado = isHorarioPassado(dataSelecionada, horario);
                const indisponivel = ocupado || passado;
                
                return (
                  <button
                    key={horario}
                    onClick={() => !indisponivel && setHorarioSelecionado(horario)}
                    disabled={indisponivel}
                    className={`py-1.5 px-2 rounded text-xs font-medium transition-all ${
                      horarioSelecionado === horario
                        ? 'bg-primary text-primary-foreground'
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

          {/* Recorrência */}
          <div className="space-y-3 bg-secondary/20 rounded-lg p-4">
            <Label className="text-foreground flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              Tipo de Agendamento
            </Label>
            <RadioGroup value={tipoRecorrencia} onValueChange={(v) => setTipoRecorrencia(v as RecorrenciaType)}>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="unico" id="unico" />
                  <Label htmlFor="unico" className="text-foreground cursor-pointer text-sm">Único</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="semanal" id="semanal" />
                  <Label htmlFor="semanal" className="text-foreground cursor-pointer text-sm">Semanal (4x)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mensal" id="mensal" />
                  <Label htmlFor="mensal" className="text-foreground cursor-pointer text-sm">Mensal (3x)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="personalizado" id="personalizado" />
                  <Label htmlFor="personalizado" className="text-foreground cursor-pointer text-sm">Personalizado</Label>
                </div>
              </div>
            </RadioGroup>

            {tipoRecorrencia === 'personalizado' && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-muted-foreground">A cada</span>
                <Select value={recorrenciaPersonalizada.toString()} onValueChange={(v) => setRecorrenciaPersonalizada(Number(v))}>
                  <SelectTrigger className="w-16 bg-secondary/50 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">semana(s)</span>
              </div>
            )}
          </div>

          {/* Resumo */}
          {servicoSelecionado && horarioSelecionado && nomeCliente && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <h4 className="font-display text-primary text-sm mb-2">Resumo</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="text-foreground font-medium">{nomeCliente}</span>
                <span className="text-muted-foreground">Serviço:</span>
                <span className="text-foreground">{servicos.find(s => s.id === servicoSelecionado)?.nome}</span>
                <span className="text-muted-foreground">Data:</span>
                <span className="text-foreground">{format(dataSelecionada, "dd/MM/yyyy")}</span>
                <span className="text-muted-foreground">Horário:</span>
                <span className="text-foreground">{horarioSelecionado} ({tempoServico}min)</span>
              </div>
            </div>
          )}

          <Button 
            onClick={criarAgendamento} 
            disabled={!servicoSelecionado || !horarioSelecionado || !nomeCliente || isLoading}
            className="w-full barber-button-primary"
          >
            {isLoading ? 'Agendando...' : 'Confirmar Agendamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
