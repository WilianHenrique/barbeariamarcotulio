import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Clock, User, Scissors, Phone, Pencil, Check, ChevronDown, Repeat } from "lucide-react";
import { format, isSameDay, isBefore, addWeeks, addMonths, addDays, addYears, startOfDay, endOfMonth, getDay, isSameWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PendingPaymentsAlert } from "@/components/dashboard/PendingPaymentsAlert";

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

type RecorrenciaType = "unico" | "semanal" | "mensal" | "personalizado" | "dias";

interface AgendamentoConflitoDia {
  data: Date;
  diaSemana: string;
  motivo: "domingo" | "segunda";
  novaData: Date | null;
  novoHorario: string | null;
  removido: boolean;
}

const NOMES_DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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

  // Números fixos (10 dígitos)
  if (numeros.length >= 7 && numeros.length <= 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  }

  // Celular (11 dígitos)
  if (numeros.length === 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 3)} ${numeros.slice(3, 7)}-${numeros.slice(7)}`;
  }

  return "";
};

const validarTelefone = (telefone: string) => {
  const numeros = telefone.replace(/\D/g, "");
  return numeros.length === 11;
};

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  agendamentosExistentes: Agendamento[];
}

export const AppointmentDialog = ({
  open,
  onOpenChange,
  onSuccess,
  agendamentosExistentes,
}: AppointmentDialogProps) => {
  const [step, setStep] = useState(1);
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefoneCliente, setTelefoneCliente] = useState("");
  const [telefoneEditavel, setTelefoneEditavel] = useState(true);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteSugestao | null>(null);
  const [clientesSugestoes, setClientesSugestoes] = useState<ClienteSugestao[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [servicoSelecionado, setServicoSelecionado] = useState<Servico | null>(null);
  const [servicoPersonalizado, setServicoPersonalizado] = useState("");
  const [isServicoPersonalizado, setIsServicoPersonalizado] = useState(false);
  const [tempoServico, setTempoServico] = useState(30);
  const [tempoServicoInput, setTempoServicoInput] = useState("30");
  const [dataSelecionada, setDataSelecionada] = useState<Date>(new Date());
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [horarioManual, setHorarioManual] = useState("");
  const [erroHorarioManual, setErroHorarioManual] = useState("");
  const [tipoRecorrencia, setTipoRecorrencia] = useState<RecorrenciaType>("unico");
  const [recorrenciaPersonalizada, setRecorrenciaPersonalizada] = useState(2);
  const [recorrenciaDias, setRecorrenciaDias] = useState(15);
  const [diasSemanaSelecionados, setDiasSemanaSelecionados] = useState<number[]>([]);
  const [conflitosdias, setConflitosDias] = useState<AgendamentoConflitoDia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [carregandoServicos, setCarregandoServicos] = useState(false);
  const sugestoesRef = useRef<HTMLDivElement | null>(null);

  // Carregar serviços do banco
  useEffect(() => {
    const carregarServicos = async () => {
      if (!open) return;

      setCarregandoServicos(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("servicos")
          .select("*")
          .eq("user_id", user.id)
          .eq("ativo", true)
          .order("ordem");

        if (error) throw error;
        console.log("AppointmentDialog: Serviços carregados:", data);
        setServicos(data || []);
      } catch (error) {
        console.error("Erro ao carregar serviços:", error);
      } finally {
        setCarregandoServicos(false);
      }
    };

    carregarServicos();
  }, [open]);

  useEffect(() => {
    if (open) {
      setStep(1);
      setNomeCliente("");
      setTelefoneCliente("");
      setTelefoneEditavel(true);
      setClienteSelecionado(null);
      setServicoSelecionado(null);
      setServicoPersonalizado("");
      setIsServicoPersonalizado(false);
      setTempoServico(30);
      setTempoServicoInput("30");
      setHorarioSelecionado(null);
      setHorarioManual("");
      setErroHorarioManual("");
      setDataSelecionada(new Date());
      setTipoRecorrencia("unico");
      setRecorrenciaPersonalizada(2);
      setRecorrenciaDias(15);
      setDiasSemanaSelecionados([]);
      setConflitosDias([]);
    }
  }, [open]);

  useEffect(() => {
    if (servicoSelecionado && !isServicoPersonalizado) {
      const duracao = servicoSelecionado.duracao_minutos;
      setTempoServico(duracao);
      setTempoServicoInput(String(duracao));
    }
  }, [servicoSelecionado, isServicoPersonalizado]);

  useEffect(() => {
    const buscarClientes = async () => {
      if (nomeCliente.length < 2) {
        setClientesSugestoes([]);
        setShowSugestoes(false);
        return;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("agendamentos")
          .select("nome_cliente, telefone_cliente")
          .eq("user_id", user.id)
          .ilike("nome_cliente", `%${nomeCliente}%`)
          .order("created_at", { ascending: false });

        const clientesUnicos =
          data?.reduce((acc: ClienteSugestao[], curr) => {
            const existe = acc.find(
              (c) => c.nome_cliente.toLowerCase() === curr.nome_cliente.toLowerCase(),
            );
            if (!existe)
              acc.push({ nome_cliente: curr.nome_cliente, telefone_cliente: curr.telefone_cliente });
            return acc;
          }, []) || [];

        setClientesSugestoes(clientesUnicos);
        setShowSugestoes(clientesUnicos.length > 0);
      } catch (error) {
        console.error("Erro ao buscar clientes:", error);
      }
    };

    const debounce = setTimeout(buscarClientes, 300);
    return () => clearTimeout(debounce);
  }, [nomeCliente]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sugestoesRef.current && !sugestoesRef.current.contains(event.target as Node)) {
        setShowSugestoes(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selecionarCliente = (cliente: ClienteSugestao) => {
    setNomeCliente(cliente.nome_cliente);
    setTelefoneCliente(cliente.telefone_cliente ? formatarTelefone(cliente.telefone_cliente) : "");
    setTelefoneEditavel(!cliente.telefone_cliente);
    setClienteSelecionado(cliente);
    setShowSugestoes(false);
  };

  const handleSelectServico = (servico: Servico) => {
    setServicoSelecionado(servico);
    setIsServicoPersonalizado(false);
    setServicoPersonalizado("");
  };

  const handleSelectPersonalizado = () => {
    setServicoSelecionado(null);
    setIsServicoPersonalizado(true);
  };

  const validarHorarioManual = (horario: string): boolean => {
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

  const gerarHorariosDisponiveis = () => {
    const horarios: string[] = [];
    for (let hora = 7; hora <= 20; hora++) {
      for (let minuto = 0; minuto < 60; minuto += 15) {
        // Para as 20h, permite apenas o horário cheio 20:00
        if (hora === 20 && minuto > 0) continue;
        horarios.push(`${hora.toString().padStart(2, "0")}:${minuto.toString().padStart(2, "0")}`);
      }
    }
    return horarios;
  };

  const isHorarioOcupado = (horario: string) => {
    const [hora, minuto] = horario.split(":").map(Number);
    const inicioNovo = new Date(dataSelecionada);
    inicioNovo.setHours(hora, minuto, 0, 0);
    const fimNovo = new Date(inicioNovo.getTime() + tempoServico * 60 * 1000);

    return agendamentosExistentes.some((ag) => {
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
    const [hora, minuto] = horario.split(":").map(Number);
    const dataHorario = new Date(dataSelecionada);
    dataHorario.setHours(hora, minuto, 0, 0);
    return isBefore(dataHorario, new Date());
  };

  const getNomeServico = () => {
    if (isServicoPersonalizado) return servicoPersonalizado;
    return servicoSelecionado?.nome || "";
  };

  // Gera datas para "a cada X dias" e detecta conflitos com dias fechados
  const gerarDatasRecorrenciaDias = (): { datas: Date[]; conflitos: AgendamentoConflitoDia[] } => {
    const datas: Date[] = [];
    const conflitos: AgendamentoConflitoDia[] = [];
    const inicioSerie = startOfDay(dataSelecionada);
    const limiteSerie = addYears(inicioSerie, 1);

    datas.push(new Date(dataSelecionada));
    let dataCursor = addDays(inicioSerie, recorrenciaDias);

    while (dataCursor <= limiteSerie) {
      const diaSemana = getDay(dataCursor);
      if (diaSemana === 0 || diaSemana === 1) {
        conflitos.push({
          data: new Date(dataCursor),
          diaSemana: NOMES_DIAS[diaSemana],
          motivo: diaSemana === 0 ? "domingo" : "segunda",
          novaData: null,
          novoHorario: null,
          removido: false,
        });
      }
      datas.push(new Date(dataCursor));
      dataCursor = addDays(dataCursor, recorrenciaDias);
    }

    return { datas, conflitos };
  };

  const handlePreviewDias = () => {
    const { conflitos } = gerarDatasRecorrenciaDias();
    setConflitosDias(conflitos);
  };

  const atualizarConflitoDia = (index: number, campo: Partial<AgendamentoConflitoDia>) => {
    setConflitosDias(prev => prev.map((c, i) => i === index ? { ...c, ...campo } : c));
  };

  const criarAgendamento = async () => {
    const nomeServico = getNomeServico();
    if (!nomeCliente || !nomeServico || !horarioSelecionado) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (telefoneCliente && !validarTelefone(telefoneCliente)) {
      toast.error("Número de WhatsApp inválido");
      return;
    }

    // Validações específicas para recorrência
    if (tipoRecorrencia === "semanal" && diasSemanaSelecionados.length === 0) {
      toast.error("Selecione pelo menos um dia da semana para o agendamento semanal.");
      return;
    }

    if (tipoRecorrencia === "mensal" && diasSemanaSelecionados.length === 0) {
      toast.error("Selecione pelo menos um dia da semana para o agendamento mensal.");
      return;
    }

    // Validação de conflitos de dias fechados
    if (tipoRecorrencia === "dias") {
      const conflitosNaoResolvidos = conflitosdias.filter(c => !c.removido && !c.novaData);
      if (conflitosNaoResolvidos.length > 0) {
        toast.error("Resolva todos os conflitos de dias fechados antes de salvar.");
        return;
      }
    }

    setIsLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const datasParaAgendar: { data: Date; horario: string }[] = [];
      const inicioSerie = startOfDay(dataSelecionada);
      const limiteSerie = addYears(inicioSerie, 1);

      if (tipoRecorrencia === "dias") {
        // Primeiro agendamento na data selecionada
        datasParaAgendar.push({ data: new Date(dataSelecionada), horario: horarioSelecionado });

        let dataCursor = addDays(inicioSerie, recorrenciaDias);
        let conflitoIdx = 0;

        while (dataCursor <= limiteSerie) {
          const diaSemana = getDay(dataCursor);
          if (diaSemana === 0 || diaSemana === 1) {
            // Procurar o conflito correspondente
            const conflito = conflitosdias[conflitoIdx];
            conflitoIdx++;
            if (conflito) {
              if (conflito.removido) {
                dataCursor = addDays(dataCursor, recorrenciaDias);
                continue;
              }
              if (conflito.novaData) {
                datasParaAgendar.push({
                  data: new Date(conflito.novaData),
                  horario: conflito.novoHorario || horarioSelecionado,
                });
                dataCursor = addDays(dataCursor, recorrenciaDias);
                continue;
              }
            }
          }
          datasParaAgendar.push({ data: new Date(dataCursor), horario: horarioSelecionado });
          dataCursor = addDays(dataCursor, recorrenciaDias);
        }
      } else {
        // Sempre adiciona o primeiro agendamento exatamente na data selecionada
        datasParaAgendar.push({ data: new Date(dataSelecionada), horario: horarioSelecionado });

        if (tipoRecorrencia === "semanal") {
          const diasSemana = diasSemanaSelecionados;
          let dataCursor = new Date(inicioSerie);
          dataCursor.setDate(dataCursor.getDate() + 1);

          while (dataCursor <= limiteSerie) {
            const mesmoDiaSemana = diasSemana.includes(getDay(dataCursor));
            const mesmaSemanaDoPrimeiro = isSameWeek(dataCursor, dataSelecionada, { weekStartsOn: 1 });

            if (mesmoDiaSemana && !mesmaSemanaDoPrimeiro) {
              datasParaAgendar.push({ data: new Date(dataCursor), horario: horarioSelecionado });
            }
            dataCursor.setDate(dataCursor.getDate() + 1);
          }
        } else if (tipoRecorrencia === "mensal") {
          const diasSemana = diasSemanaSelecionados;
          let dataMesBase = new Date(inicioSerie);

          while (dataMesBase <= limiteSerie) {
            diasSemana.forEach((diaSemana) => {
              const primeiroDiaMes = new Date(dataMesBase.getFullYear(), dataMesBase.getMonth(), 1);
              let diaAtual = new Date(primeiroDiaMes);
              while (getDay(diaAtual) !== diaSemana) {
                diaAtual.setDate(diaAtual.getDate() + 1);
              }

              while (diaAtual.getMonth() === dataMesBase.getMonth() && diaAtual <= limiteSerie) {
                if (diaAtual >= inicioSerie) {
                  datasParaAgendar.push({ data: new Date(diaAtual), horario: horarioSelecionado });
                }
                diaAtual.setDate(diaAtual.getDate() + 7);
              }
            });
            dataMesBase = addMonths(dataMesBase, 1);
          }
        } else if (tipoRecorrencia === "personalizado") {
          const diaSemanaAlvo = diasSemanaSelecionados.length > 0 ? diasSemanaSelecionados[0] : null;
          let dataCursor = new Date(inicioSerie);
          
          if (diaSemanaAlvo !== null) {
            const diaAtual = dataCursor.getDay();
            let diff = diaSemanaAlvo - diaAtual;
            if (diff <= 0) diff += 7;
            dataCursor.setDate(dataCursor.getDate() + diff);
            datasParaAgendar.push({ data: new Date(dataCursor), horario: horarioSelecionado });
            dataCursor = addWeeks(dataCursor, recorrenciaPersonalizada);
          } else {
            dataCursor = addWeeks(dataCursor, recorrenciaPersonalizada);
          }

          while (dataCursor <= limiteSerie) {
            datasParaAgendar.push({ data: new Date(dataCursor), horario: horarioSelecionado });
            dataCursor = addWeeks(dataCursor, recorrenciaPersonalizada);
          }
        }
      }

      const idSerieRecorrente =
        tipoRecorrencia !== "unico"
          ? `serie-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          : null;

      const agendamentos = datasParaAgendar.map((item) => {
        const [hora, minuto] = item.horario.split(":").map(Number);
        const datetimeStart = new Date(item.data);
        datetimeStart.setHours(hora, minuto, 0, 0);
        const datetimeEnd = new Date(datetimeStart.getTime() + tempoServico * 60 * 1000);

        return {
          user_id: user.id,
          nome_cliente: nomeCliente,
          telefone_cliente: telefoneCliente.replace(/\D/g, "") || null,
          servico: nomeServico,
          datetime_start: datetimeStart.toISOString(),
          datetime_end: datetimeEnd.toISOString(),
          dia_agendado: format(item.data, "yyyy-MM-dd"),
          dia_agendado_formatado: format(item.data, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
          hora_agendada: item.horario,
          hora_final: format(datetimeEnd, "HH:mm"),
          tempo_total_minutos: tempoServico,
          evento_recorrente: tipoRecorrencia !== "unico" ? "Sim" : "Não",
          status_evento: "confirmado",
          link_evento: idSerieRecorrente || "",
          id_evento: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
      });

      const { error } = await supabase.from("agendamentos").insert(agendamentos);

      if (error) throw error;

      toast.success(`${agendamentos.length} agendamento(s) criado(s) com sucesso!`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao criar agendamento:", error?.message || error);
      toast.error(error?.message || "Erro ao criar agendamento");
    } finally {
      setIsLoading(false);
    }
  };

  const horarios = gerarHorariosDisponiveis();

  const canProceedStep1 =
    (servicoSelecionado || (isServicoPersonalizado && servicoPersonalizado.trim())) && tempoServico > 0;
  const canProceedStep2 = horarioSelecionado;
  const canConfirm = nomeCliente.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Novo Agendamento
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 py-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  step >= s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                )}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div className={cn("flex-1 h-0.5", step > s ? "bg-primary" : "bg-secondary")} />
              )}
            </div>
          ))}
        </div>

        <div className="space-y-4 py-2">
          {/* Step 1: Serviço e Tempo */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-2">
                <Label className="text-foreground text-sm flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-primary" />
                  Serviço
                </Label>
                {carregandoServicos ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {servicos.length === 0 ? (
                      <div className="col-span-2 text-center py-4 text-muted-foreground text-sm">
                        Nenhum serviço cadastrado. Adicione serviços nas Configurações.
                      </div>
                    ) : (
                      servicos.map((servico) => (
                        <button
                          key={servico.id}
                          onClick={() => handleSelectServico(servico)}
                          className={cn(
                            "p-3 rounded-lg border text-left transition-all text-sm",
                            servicoSelecionado?.id === servico.id
                              ? "border-primary bg-primary/10 text-primary-foreground"
                              : "border-border/60 bg-card/40 hover:border-primary/60 hover:bg-card",
                          )}
                        >
                          <div className="font-medium text-foreground">{servico.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            Duração sugerida: {servico.duracao_minutos} min
                          </div>
                        </button>
                      ))
                    )}

                    <button
                      onClick={handleSelectPersonalizado}
                      className={cn(
                        "col-span-2 p-3 rounded-lg border-dashed border text-left transition-all text-sm",
                        isServicoPersonalizado
                          ? "border-primary bg-primary/5 text-primary-foreground"
                          : "border-border/60 bg-card/40 hover:border-primary/60 hover:bg-card",
                      )}
                    >
                      <div className="font-medium flex items-center gap-2 text-foreground">
                        Serviço personalizado
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Defina o nome e o tempo manualmente
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {isServicoPersonalizado && (
                <div className="space-y-2">
                  <Label className="text-foreground text-sm">Nome do serviço</Label>
                  <Input
                    value={servicoPersonalizado}
                    onChange={(e) => setServicoPersonalizado(e.target.value)}
                    placeholder="Ex: Corte especial, Design de barba..."
                    className="input-refined"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-foreground text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Tempo do Procedimento (minutos)
                </Label>
                <Input
                  type="number"
                  value={tempoServicoInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Permite campo vazio enquanto o usuário digita
                    setTempoServicoInput(value);

                    if (value === "") {
                      return;
                    }

                    const parsed = parseInt(value, 10);
                    if (!Number.isNaN(parsed)) {
                      setTempoServico(parsed);
                    }
                  }}
                  min={1}
                  className="input-refined"
                />
              </div>

              <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="w-full btn-primary">
                Continuar
              </Button>
            </div>
          )}

          {/* Step 2: Data e Hora */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-secondary/30 rounded-lg p-3 mb-2">
                <div className="text-sm text-muted-foreground">Serviço selecionado:</div>
                <div className="text-foreground font-medium">
                  {getNomeServico()} - {tempoServico} min
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground text-sm">Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
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
                          setHorarioSelecionado(null);
                        }
                      }}
                      disabled={(date) => isBefore(date, new Date(new Date().setHours(0, 0, 0, 0)))}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-3">
                <Label className="text-foreground text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Horário
                </Label>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Digite o horário (HH:mm)</Label>
                  <Input
                    type="text"
                    value={horarioManual}
                    onChange={(e) => handleHorarioManualChange(e.target.value)}
                    placeholder="Ex: 14:30"
                    className={cn("font-mono", erroHorarioManual && "border-destructive focus:border-destructive")}
                    maxLength={5}
                  />
                  {erroHorarioManual && <p className="text-xs text-destructive">{erroHorarioManual}</p>}
                  {horarioManual && validarHorarioManual(horarioManual) && !erroHorarioManual && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Horário válido e disponível
                    </p>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou selecione</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                  {horarios.map((horario) => {
                    const ocupado = isHorarioOcupado(horario);
                    const passado = isHorarioPassado(horario);
                    const disabled = ocupado || passado;

                    return (
                      <button
                        key={horario}
                        onClick={() => {
                          if (!disabled) {
                            setHorarioSelecionado(horario);
                            setHorarioManual(horario);
                            setErroHorarioManual("");
                          }
                        }}
                        disabled={disabled}
                        className={cn(
                          "py-2 px-3 rounded-md text-sm font-medium transition-all",
                          horarioSelecionado === horario
                            ? "bg-primary text-primary-foreground"
                            : disabled
                            ? "bg-secondary/30 text-muted-foreground/50 cursor-not-allowed"
                            : "bg-secondary text-foreground hover:bg-secondary/80",
                        )}
                      >
                        {horario}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 bg-secondary/20 rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-foreground flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-primary" />
                    Agendamento recorrente?
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={tipoRecorrencia === "unico" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTipoRecorrencia("unico")}
                    >
                      Não
                    </Button>
                    <Button
                      type="button"
                      variant={tipoRecorrencia !== "unico" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (tipoRecorrencia === "unico") {
                          setTipoRecorrencia("semanal");
                        }
                      }}
                    >
                      Sim
                    </Button>
                  </div>
                </div>

                {tipoRecorrencia !== "unico" && (
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={tipoRecorrencia === "semanal" ? "default" : "outline"}
                        onClick={() => setTipoRecorrencia("semanal")}
                      >
                        Semanal (toda semana)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={tipoRecorrencia === "mensal" ? "default" : "outline"}
                        onClick={() => setTipoRecorrencia("mensal")}
                      >
                        Mensal (dias da semana)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={tipoRecorrencia === "personalizado" ? "default" : "outline"}
                        onClick={() => setTipoRecorrencia("personalizado")}
                      >
                        Personalizado (a cada X semanas)
                      </Button>
                    </div>

                    {tipoRecorrencia === "personalizado" && (
                      <div className="space-y-3 mt-1">
                        <div className="flex items-center gap-2">
                          <span>A cada</span>
                          <select
                            className="w-16 h-8 rounded-md border border-border bg-card text-foreground text-sm text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary cursor-pointer"
                            value={recorrenciaPersonalizada}
                            onChange={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              if (!Number.isNaN(parsed)) {
                                setRecorrenciaPersonalizada(Math.min(4, Math.max(1, parsed)));
                              }
                            }}
                          >
                            {[1, 2, 3, 4].map((n) => (
                              <option key={n} value={n} className="bg-card text-foreground">
                                {n}
                              </option>
                            ))}
                          </select>
                          <span>semana(s)</span>
                        </div>
                        <div>
                          <Label className="text-xs text-foreground">Dia da semana</Label>
                          <div className="grid grid-cols-4 gap-2 mt-1">
                            {[
                              { label: "Seg", value: 1 },
                              { label: "Ter", value: 2 },
                              { label: "Qua", value: 3 },
                              { label: "Qui", value: 4 },
                              { label: "Sex", value: 5 },
                              { label: "Sáb", value: 6 },
                              { label: "Dom", value: 0 },
                            ].map(({ label, value }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => {
                                  setDiasSemanaSelecionados([value]);
                                }}
                                className={cn(
                                  "py-1.5 px-2 rounded-md text-xs font-medium transition-all",
                                  diasSemanaSelecionados.includes(value)
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary",
                                )}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Deixe vazio para usar o dia da data selecionada.
                          </p>
                        </div>
                      </div>
                    )}

                    {tipoRecorrencia === "semanal" && (
                      <div className="space-y-2 mt-1">
                        <Label className="text-xs text-foreground">Dias da semana</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: "Seg", value: 1 },
                            { label: "Ter", value: 2 },
                            { label: "Qua", value: 3 },
                            { label: "Qui", value: 4 },
                            { label: "Sex", value: 5 },
                            { label: "Sáb", value: 6 },
                            { label: "Dom", value: 0 },
                          ].map(({ label, value }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                setDiasSemanaSelecionados((prev) =>
                                  prev.includes(value)
                                    ? prev.filter((d) => d !== value)
                                    : [...prev, value].sort(),
                                );
                              }}
                              className={cn(
                                "py-1.5 px-2 rounded-md text-xs font-medium transition-all",
                                diasSemanaSelecionados.includes(value)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary",
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Deixe vazio para usar o dia da semana selecionado. Serão criados horários nesses dias
                          todas as semanas nos próximos 12 meses.
                        </p>
                      </div>
                    )}

                    {tipoRecorrencia === "mensal" && (
                      <div className="space-y-2 mt-1">
                        <Label className="text-xs text-foreground">Dias da semana</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: "Seg", value: 1 },
                            { label: "Ter", value: 2 },
                            { label: "Qua", value: 3 },
                            { label: "Qui", value: 4 },
                            { label: "Sex", value: 5 },
                            { label: "Sáb", value: 6 },
                            { label: "Dom", value: 0 },
                          ].map(({ label, value }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => {
                                setDiasSemanaSelecionados((prev) =>
                                  prev.includes(value)
                                    ? prev.filter((d) => d !== value)
                                    : [...prev, value].sort(),
                                );
                              }}
                              className={cn(
                                "py-1.5 px-2 rounded-md text-xs font-medium transition-all",
                                diasSemanaSelecionados.includes(value)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary",
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Deixe vazio para usar o dia da semana selecionado. Serão criados horários em todos esses
                          dias da semana nos próximos 12 meses.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Voltar
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!canProceedStep2}
                  className="flex-1 btn-primary"
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Cliente e Confirmação */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-secondary/30 rounded-lg p-3 mb-2">
                <div className="text-sm text-muted-foreground">Agendamento:</div>
                <div className="text-foreground font-medium">
                  {getNomeServico()} - {format(dataSelecionada, "dd/MM")} às {horarioSelecionado}
                </div>
              </div>

              <div className="space-y-2 relative" ref={sugestoesRef}>
                <Label className="text-foreground text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Nome do Cliente
                </Label>
                <Input
                  value={nomeCliente}
                  onChange={(e) => {
                    setNomeCliente(e.target.value);
                    setTelefoneEditavel(true);
                    // Só exibimos aviso de pendências após selecionar um cliente existente.
                    setClienteSelecionado(null);
                  }}
                  placeholder="Digite o nome"
                  className="input-refined"
                />

                {showSugestoes && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {clientesSugestoes.map((cliente, i) => (
                      <button
                        key={i}
                        onClick={() => selecionarCliente(cliente)}
                        className="w-full px-3 py-2.5 text-left hover:bg-secondary transition-colors flex items-center justify-between"
                      >
                        <span className="text-foreground text-sm">{cliente.nome_cliente}</span>
                        <span className="text-xs text-muted-foreground">Cliente existente</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <PendingPaymentsAlert
                enabled={!!clienteSelecionado}
                nomeCliente={clienteSelecionado?.nome_cliente || nomeCliente}
                telefoneCliente={clienteSelecionado?.telefone_cliente}
              />

              <div className="space-y-2">
                <Label className="text-foreground text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  WhatsApp (opcional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={telefoneCliente}
                    onChange={(e) => setTelefoneCliente(formatarTelefone(e.target.value))}
                    placeholder="(xx) x xxxx-xxxx"
                    className="input-refined flex-1"
                    disabled={!telefoneEditavel}
                    maxLength={17}
                  />
                  {!telefoneEditavel && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setTelefoneEditavel(true)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="bg-secondary/30 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-foreground">Resumo do Agendamento</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Serviço:</span>
                    <span className="text-foreground">{getNomeServico()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span className="text-foreground">
                      {format(dataSelecionada, "dd/MM/yyyy")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Horário:</span>
                    <span className="text-foreground">{horarioSelecionado}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duração:</span>
                    <span className="text-foreground">{tempoServico} minutos</span>
                  </div>
                  {nomeCliente && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cliente:</span>
                      <span className="text-foreground font-medium">{nomeCliente}</span>
                    </div>
                  )}
                  {telefoneCliente && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">WhatsApp:</span>
                      <span className="text-foreground">{telefoneCliente}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Voltar
                </Button>
                <Button
                  onClick={criarAgendamento}
                  disabled={isLoading || !canConfirm}
                  className="flex-1 btn-primary"
                >
                  {isLoading ? "Salvando..." : "Confirmar Agendamento"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
