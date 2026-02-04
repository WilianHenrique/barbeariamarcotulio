import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Clock, User, Scissors, Phone, ChevronDown, Trash2, Save, X } from "lucide-react";
import { format, isSameDay, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Agendamento {
  id: string;
  nome_cliente: string;
  telefone_cliente?: string | null;
  datetime_start: string;
  datetime_end: string;
  dia_agendado: string;
  hora_agendada: string;
  hora_final: string;
  servico: string;
  tempo_total_minutos: number;
  desmarcado?: boolean;
}

interface EditAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamento: Agendamento | null;
  onSuccess: () => void;
  onDelete: (id: string, nome: string) => void;
  agendamentosExistentes: Agendamento[];
}

const formatarTelefone = (value: string) => {
  let numeros = value.replace(/\D/g, "");

  // Remove código do país +55 quando vier copiado do WhatsApp
  if (numeros.startsWith("55") && numeros.length > 10) {
    numeros = numeros.slice(2);
  }

  // Garante no máximo 11 dígitos (DDD + número)
  if (numeros.length > 11) {
    numeros = numeros.slice(-11);
  }

  if (numeros.length <= 2) return numeros.length > 0 ? `(${numeros}` : "";
  if (numeros.length <= 6) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  if (numeros.length >= 7 && numeros.length <= 10)
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  if (numeros.length === 11)
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 3)} ${numeros.slice(3, 7)}-${numeros.slice(7)}`;
  return "";
};

const validarTelefone = (telefone: string) => {
  const numeros = telefone.replace(/\D/g, '');
  return numeros.length === 0 || numeros.length === 11;
};

const SERVICOS = [
  { id: "barba", nome: "Barba", tempo: 30 },
  { id: "cabelo", nome: "Cabelo", tempo: 45 },
  { id: "sobrancelha", nome: "Sobrancelha", tempo: 15 },
  { id: "barba_cabelo", nome: "Barba + Cabelo", tempo: 60 },
  { id: "pezinho", nome: "Pezinho", tempo: 15 },
  { id: "combo", nome: "Barba + Cabelo + Sobrancelha", tempo: 75 },
];

export const EditAppointmentDialog = ({
  open,
  onOpenChange,
  agendamento,
  onSuccess,
  onDelete,
  agendamentosExistentes
}: EditAppointmentDialogProps) => {
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefoneCliente, setTelefoneCliente] = useState("");
  const [servico, setServico] = useState("");
  const [tempoServico, setTempoServico] = useState(30);
  const [dataSelecionada, setDataSelecionada] = useState<Date>(new Date());
  const [horarioSelecionado, setHorarioSelecionado] = useState<string>("");
  const [horarioManual, setHorarioManual] = useState("");
  const [erroHorarioManual, setErroHorarioManual] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [desmarcado, setDesmarcado] = useState(false);

  useEffect(() => {
    if (agendamento && open) {
      setNomeCliente(agendamento.nome_cliente);
      setTelefoneCliente(agendamento.telefone_cliente ? formatarTelefone(agendamento.telefone_cliente) : "");
      setServico(agendamento.servico);
      setTempoServico(agendamento.tempo_total_minutos);
      setDataSelecionada(new Date(agendamento.dia_agendado + 'T12:00:00'));
      setHorarioSelecionado(agendamento.hora_agendada);
      setHorarioManual(agendamento.hora_agendada);
      setErroHorarioManual("");
      setShowConfirmDelete(false);
      setDesmarcado(!!agendamento.desmarcado);
    }
  }, [agendamento, open]);

  const handleToggleDesmarcado = async () => {
    if (!agendamento) return;

    const next = !desmarcado;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ desmarcado: next })
        .eq("id", agendamento.id);

      if (error) throw error;
      setDesmarcado(next);
      toast.success(next ? "Agendamento marcado como desmarcado" : "Agendamento reativado");
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao atualizar status do agendamento:", error);
      toast.error("Erro ao atualizar status");
    } finally {
      setIsLoading(false);
    }
  };

  const gerarHorariosDisponiveis = () => {
    const horarios: string[] = [];
    for (let hora = 8; hora < 20; hora++) {
      for (let minuto = 0; minuto < 60; minuto += 15) {
        horarios.push(`${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`);
      }
    }
    return horarios;
  };

  const isHorarioOcupado = (horario: string) => {
    if (!agendamento) return false;
    
    const [hora, minuto] = horario.split(':').map(Number);
    const inicioNovo = new Date(dataSelecionada);
    inicioNovo.setHours(hora, minuto, 0, 0);
    const fimNovo = new Date(inicioNovo.getTime() + tempoServico * 60 * 1000);

    return agendamentosExistentes
      .filter(ag => ag.id !== agendamento.id) // Ignorar o próprio agendamento
      .some(ag => {
        const inicioExistente = new Date(ag.datetime_start);
        const fimExistente = new Date(ag.datetime_end);
        
        return (
          isSameDay(inicioExistente, dataSelecionada) &&
          ((inicioNovo >= inicioExistente && inicioNovo < fimExistente) ||
           (fimNovo > inicioExistente && fimNovo <= fimExistente) ||
           (inicioNovo <= inicioExistente && fimNovo >= fimExistente))
        );
      });
  };

  const isHorarioPassado = (horario: string) => {
    const [hora, minuto] = horario.split(':').map(Number);
    const dataHorario = new Date(dataSelecionada);
    dataHorario.setHours(hora, minuto, 0, 0);
    return isBefore(dataHorario, new Date());
  };

  const validarHorarioManual = (horario: string) => {
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(horario);
  };

  const handleHorarioManualChange = (valor: string) => {
    let numerosSomente = valor.replace(/\D/g, "");

    if (numerosSomente.length > 4) {
      numerosSomente = numerosSomente.slice(0, 4);
    }

    let horarioFormatado = "";
    if (numerosSomente.length >= 1) {
      horarioFormatado = numerosSomente.slice(0, 2);
      if (numerosSomente.length > 2) {
        horarioFormatado += ":" + numerosSomente.slice(2, 4);
      }
    }

    setHorarioManual(horarioFormatado);
    setErroHorarioManual("");

    if (horarioFormatado.length === 5 && validarHorarioManual(horarioFormatado)) {
      const ocupado = isHorarioOcupado(horarioFormatado);
      const passado = isHorarioPassado(horarioFormatado);

      if (ocupado) {
        setErroHorarioManual("Este horário já está ocupado");
      } else if (passado) {
        setErroHorarioManual("Este horário já passou");
      } else {
        setHorarioSelecionado(horarioFormatado);
      }
    } else if (horarioFormatado.length === 5) {
      setErroHorarioManual("Horário inválido");
    }
  };

  const handleSave = async () => {
    if (!agendamento) return;
    
    if (!nomeCliente.trim()) {
      toast.error("Nome do cliente é obrigatório");
      return;
    }

    if (!servico.trim()) {
      toast.error("Serviço é obrigatório");
      return;
    }

    if (!horarioSelecionado) {
      toast.error("Selecione um horário");
      return;
    }

    if (!validarTelefone(telefoneCliente)) {
      toast.error("Número de WhatsApp inválido");
      return;
    }

    setIsLoading(true);

    try {
      const [hora, minuto] = horarioSelecionado.split(':').map(Number);
      const datetimeStart = new Date(dataSelecionada);
      datetimeStart.setHours(hora, minuto, 0, 0);
      const datetimeEnd = new Date(datetimeStart.getTime() + tempoServico * 60 * 1000);

      const { error } = await supabase
        .from('agendamentos')
        .update({
          nome_cliente: nomeCliente,
          telefone_cliente: telefoneCliente.replace(/\D/g, '') || null,
          servico: servico,
          datetime_start: datetimeStart.toISOString(),
          datetime_end: datetimeEnd.toISOString(),
          dia_agendado: format(dataSelecionada, 'yyyy-MM-dd'),
          dia_agendado_formatado: format(dataSelecionada, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
          hora_agendada: horarioSelecionado,
          hora_final: format(datetimeEnd, 'HH:mm'),
          tempo_total_minutos: tempoServico,
          desmarcado,
        })
        .eq('id', agendamento.id);

      if (error) throw error;

      toast.success("Agendamento atualizado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao atualizar agendamento:', error);
      toast.error("Erro ao atualizar agendamento");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (!agendamento) return;
    onDelete(agendamento.id, agendamento.nome_cliente);
    onOpenChange(false);
  };

  const horarios = gerarHorariosDisponiveis();
  const isPastAppointment = agendamento ? new Date(agendamento.datetime_start) < new Date() : false;

  if (!agendamento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Detalhes do Agendamento
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Visualize ou edite as informações do agendamento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info do cliente */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-foreground text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Nome do Cliente
              </Label>
              <Input
                value={nomeCliente}
                onChange={(e) => setNomeCliente(e.target.value)}
                className="input-refined"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground text-sm flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                WhatsApp
              </Label>
              <Input
                value={telefoneCliente}
                onChange={(e) => setTelefoneCliente(formatarTelefone(e.target.value))}
                placeholder="(00) 0 0000-0000"
                className="input-refined"
              />
            </div>
          </div>

          {/* Serviço */}
          <div className="space-y-2">
            <Label className="text-foreground text-sm flex items-center gap-2">
              <Scissors className="h-4 w-4 text-primary" />
              Serviço
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {SERVICOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { 
                    setServico(s.nome); 
                    setTempoServico(s.tempo); 
                  }}
                  className={cn(
                    "p-2 rounded-lg border text-left transition-all text-sm",
                    servico === s.nome
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-secondary/30 text-muted-foreground hover:border-border hover:bg-secondary/50"
                  )}
                >
                  <span className="font-medium block text-xs">{s.nome}</span>
                </button>
              ))}
            </div>
            
            {/* Serviço personalizado */}
            <Input
              value={servico}
              onChange={(e) => setServico(e.target.value)}
              placeholder="Ou digite um serviço personalizado..."
              className="input-refined mt-2"
            />
          </div>

          {/* Tempo */}
          <div className="space-y-2">
            <Label className="text-foreground text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Tempo do Procedimento (minutos)
            </Label>
            <Input
              type="number"
              value={tempoServico}
              onChange={(e) => setTempoServico(Math.max(1, parseInt(e.target.value) || 0))}
              min={1}
              className="input-refined"
              disabled={isPastAppointment}
            />
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label className="text-foreground text-sm">Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between font-normal"
                >
                  {format(dataSelecionada, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dataSelecionada}
                  onSelect={(date) => { 
                    if (date) {
                      setDataSelecionada(date); 
                      setHorarioSelecionado(""); 
                    }
                  }}
                  disabled={(date) => isBefore(date, new Date(new Date().setHours(0,0,0,0)))}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Horários */}
          <div className="space-y-2">
            <Label className="text-foreground text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Horário
            </Label>

            <Input
              value={horarioManual}
              onChange={(e) => handleHorarioManualChange(e.target.value)}
              placeholder="Digite o horário (ex: 17:15)"
              className="input-refined"
            />
            {erroHorarioManual && (
              <p className="text-xs text-destructive mt-1">{erroHorarioManual}</p>
            )}

            <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
              {horarios.map((horario) => {
                const ocupado = isHorarioOcupado(horario);
                const passado = isHorarioPassado(horario);
                const disabled = ocupado || passado;

                return (
                  <button
                    key={horario}
                    onClick={() => !disabled && (setHorarioSelecionado(horario), setHorarioManual(horario), setErroHorarioManual(""))}
                    disabled={disabled}
                    className={cn(
                      "py-2 px-3 rounded-md text-sm font-medium transition-all",
                      horarioSelecionado === horario
                        ? "bg-primary text-primary-foreground"
                        : disabled
                          ? "bg-secondary/30 text-muted-foreground/50 cursor-not-allowed"
                          : "bg-secondary text-foreground hover:bg-secondary/80"
                    )}
                  >
                    {horario}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aviso de agendamento passado */}
          {isPastAppointment && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-500">
              Este agendamento já passou. Você pode editar, mas atenção para não alterar dados históricos sem necessidade.
            </div>
          )}

          {/* Status: cliente não veio */}
          {isPastAppointment && (
            <div
              className={cn(
                "rounded-lg border p-4",
                desmarcado
                  ? "bg-amber-500/10 border-amber-500/20"
                  : "bg-secondary/30 border-border"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={cn("text-sm font-medium", desmarcado ? "text-amber-400" : "text-foreground")}>
                    {desmarcado ? "Agendamento desmarcado" : "Cliente não veio?"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ao marcar como desmarcado, este agendamento não entra no faturamento.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={desmarcado ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleDesmarcado}
                  disabled={isLoading}
                  className={desmarcado ? "bg-amber-500 text-background hover:bg-amber-500/90" : ""}
                >
                  {desmarcado ? "Reativar" : "Marcar desmarcado"}
                </Button>
              </div>
            </div>
          )}

          {/* Confirmação de exclusão */}
          {showConfirmDelete && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3">
              <p className="text-sm text-destructive font-medium">
                Tem certeza que deseja excluir este agendamento?
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirmDelete(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => setShowConfirmDelete(true)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={showConfirmDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>
          
          {!isPastAppointment && (
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1 btn-primary"
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? "Salvando..." : "Salvar"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};