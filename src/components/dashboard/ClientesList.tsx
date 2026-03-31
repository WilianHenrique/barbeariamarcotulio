import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, User, Phone, Calendar, Edit, ChevronRight, MessageSquare, Clock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addWeeks, format, getDay, isSameMonth, isSameWeek, isSameYear, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditAppointmentDialog } from "./EditAppointmentDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Agendamento {
  id: string;
  nome_cliente: string;
  telefone_cliente?: string | null;
  servico: string;
  dia_agendado: string;
  hora_agendada: string;
  status_evento: string;
  datetime_start: string;
  datetime_end: string;
  hora_final: string;
  tempo_total_minutos: number;
  notificacao_24h_enviada?: boolean | null;
  notificacao_1h_enviada?: boolean | null;
  desmarcado?: boolean;
  evento_recorrente?: string;
  link_evento?: string;
}

type TipoRecorrenciaEdicao = "semanal" | "personalizado";


interface ClientesListProps {
  agendamentos: Agendamento[];
  onRefresh: () => void;
}

interface Cliente {
  nome: string;
  telefone: string | null;
  totalAgendamentos: number;
  ultimoAgendamento: string;
}

interface HistoricoMensagem {
  id: string;
  tipo_notificacao: string;
  mensagem_enviada: string;
  enviado_em: string;
  status: string;
}

interface AtualizacaoRecorrencia {
  agendamento: Agendamento;
  novoInicio: Date;
  novoFim: Date;
}

interface ConflitoRecorrencia {
  agendamentoSerie: Agendamento;
  agendamentoConflito: Agendamento;
  novoInicio: Date;
  novoFim: Date;
}

export const ClientesList = ({ agendamentos, onRefresh }: ClientesListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [originalNome, setOriginalNome] = useState("");
  const [periodoFiltro, setPeriodoFiltro] = useState<"todos" | "semana" | "mes" | "ano">("todos");
  const [historicoMensagens, setHistoricoMensagens] = useState<HistoricoMensagem[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  const [showEditAgendamento, setShowEditAgendamento] = useState(false);
  const [showEditRecorrencia, setShowEditRecorrencia] = useState(false);
  const [agendamentoSerieBase, setAgendamentoSerieBase] = useState<Agendamento | null>(null);
  const [tipoRecorrenciaEdicao, setTipoRecorrenciaEdicao] = useState<TipoRecorrenciaEdicao>("semanal");
  const [diasSemanaRecorrencia, setDiasSemanaRecorrencia] = useState<number[]>([]);
  const [intervaloSemanasRecorrencia, setIntervaloSemanasRecorrencia] = useState(2);
  const [horaRecorrencia, setHoraRecorrencia] = useState("08:00");
  const [isSavingRecorrencia, setIsSavingRecorrencia] = useState(false);

  const diasSemana = [
    { valor: 0, label: "Dom" },
    { valor: 1, label: "Seg" },
    { valor: 2, label: "Ter" },
    { valor: 3, label: "Qua" },
    { valor: 4, label: "Qui" },
    { valor: 5, label: "Sex" },
    { valor: 6, label: "Sáb" },
  ];

  // Agrupa clientes únicos
  const clientes = useMemo(() => {
    const clientesMap = new Map<string, Cliente>();

    agendamentos.forEach((ag) => {
      const nomeNormalizado = ag.nome_cliente.trim().toLowerCase();
      const existing = clientesMap.get(nomeNormalizado);

      if (existing) {
        existing.totalAgendamentos++;
        if (ag.dia_agendado > existing.ultimoAgendamento) {
          existing.ultimoAgendamento = ag.dia_agendado;
          existing.telefone = ag.telefone_cliente || existing.telefone;
        }
      } else {
        clientesMap.set(nomeNormalizado, {
          nome: ag.nome_cliente,
          telefone: ag.telefone_cliente ?? null,
          totalAgendamentos: 1,
          ultimoAgendamento: ag.dia_agendado,
        });
      }
    });

    return Array.from(clientesMap.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [agendamentos]);

  // Filtra clientes pela busca
  const clientesFiltrados = useMemo(() => {
    if (!searchTerm) return clientes;
    const term = searchTerm.toLowerCase();
    return clientes.filter(
      (c) => c.nome.toLowerCase().includes(term) || (c.telefone && c.telefone.includes(term))
    );
  }, [clientes, searchTerm]);

  // Agendamentos do cliente selecionado (ordenados futuros primeiro, depois passados)
  const agendamentosCliente = useMemo(() => {
    if (!selectedCliente) return [];
    const todosDoCliente = agendamentos
      .filter(
        (ag) => ag.nome_cliente.trim().toLowerCase() === selectedCliente.nome.trim().toLowerCase()
      );

    const agora = new Date();
    const futuros = todosDoCliente
      .filter((ag) => new Date(ag.datetime_start) >= agora)
      .sort((a, b) => new Date(a.datetime_start).getTime() - new Date(b.datetime_start).getTime());

    const passados = todosDoCliente
      .filter((ag) => new Date(ag.datetime_start) < agora)
      .sort((a, b) => new Date(b.datetime_start).getTime() - new Date(a.datetime_start).getTime());

    return [...futuros, ...passados];
  }, [agendamentos, selectedCliente]);

  // Aplica filtro por período (semana, mês, ano)
  const agendamentosFiltrados = useMemo(() => {
    if (!selectedCliente) return [];
    const hoje = new Date();

    return agendamentosCliente.filter((ag) => {
      const data = parse(ag.dia_agendado, "yyyy-MM-dd", new Date());

      switch (periodoFiltro) {
        case "semana":
          return isSameWeek(data, hoje, { weekStartsOn: 1 });
        case "mes":
          return isSameMonth(data, hoje);
        case "ano":
          return isSameYear(data, hoje);
        default:
          return true;
      }
    });
  }, [agendamentosCliente, periodoFiltro, selectedCliente]);

  const handleSelectCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setPeriodoFiltro("todos");
    setShowDetails(true);
  };

  // Carrega histórico de mensagens do cliente selecionado (últimas 50)
  useEffect(() => {
    const loadHistoricoMensagens = async () => {
      if (!selectedCliente) return;
      setLoadingHistorico(true);
      try {
        const { data, error } = await supabase
          .from("historico_mensagens")
          .select("*")
          .eq("nome_cliente", selectedCliente.nome)
          .order("enviado_em", { ascending: false })
          .limit(50);

        if (error) throw error;
        setHistoricoMensagens(data || []);
      } catch (error) {
        console.error("Erro ao carregar histórico de mensagens:", error);
      } finally {
        setLoadingHistorico(false);
      }
    };

    loadHistoricoMensagens();
  }, [selectedCliente]);

  const handleOpenEdit = () => {
    if (selectedCliente) {
      setEditNome(selectedCliente.nome);
      setEditTelefone(selectedCliente.telefone || "");
      setOriginalNome(selectedCliente.nome);
      setShowEdit(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editNome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      // Atualiza todos os agendamentos deste cliente
      const { error } = await supabase
        .from("agendamentos")
        .update({
          nome_cliente: editNome.trim(),
          telefone_cliente: editTelefone.trim() || null,
        })
        .ilike("nome_cliente", originalNome);

      if (error) throw error;

      toast.success("Dados do cliente atualizados!");
      setShowEdit(false);
      setShowDetails(false);
      setSelectedCliente(null);
      onRefresh();
    } catch (error) {
      console.error("Erro ao atualizar cliente:", error);
      toast.error("Erro ao atualizar dados do cliente");
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const parsed = parse(dateStr, "yyyy-MM-dd", new Date());
      return format(parsed, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const handleDeleteAgendamento = async (id: string, nome: string) => {
    try {
      const { error } = await supabase.from("agendamentos").delete().eq("id", id);
      if (error) throw error;
      toast.success(`Agendamento de ${nome} excluído`);
      setShowEditAgendamento(false);
      setSelectedAgendamento(null);
      onRefresh();
    } catch (error) {
      console.error("Erro ao excluir agendamento:", error);
      toast.error("Erro ao excluir agendamento");
    }
  };

  const handleDeleteCliente = async () => {
    if (!selectedCliente) return;

    try {
      const { error } = await supabase
        .from("agendamentos")
        .delete()
        .ilike("nome_cliente", selectedCliente.nome);

      if (error) throw error;

      toast.success(`Cliente ${selectedCliente.nome} e seus agendamentos foram removidos.`);
      setShowDetails(false);
      setSelectedCliente(null);
      onRefresh();
    } catch (error) {
      console.error("Erro ao excluir cliente:", error);
      toast.error("Erro ao excluir cliente");
    }
  };

  const toggleDiaSemanaRecorrencia = (dia: number) => {
    setDiasSemanaRecorrencia((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort((a, b) => a - b),
    );
  };

  const handleOpenEditRecorrencia = (ag: Agendamento) => {
    if (ag.evento_recorrente !== "Sim" || !ag.link_evento) {
      toast.error("Este agendamento não faz parte de uma série recorrente.");
      return;
    }

    const diaBase = getDay(new Date(ag.datetime_start));
    setAgendamentoSerieBase(ag);
    setTipoRecorrenciaEdicao("semanal");
    setDiasSemanaRecorrencia([diaBase]);
    setIntervaloSemanasRecorrencia(2);
    setHoraRecorrencia(format(new Date(ag.datetime_start), "HH:mm"));
    setShowEditRecorrencia(true);
  };

  const gerarDatasRecorrencia = useCallback(({
    dataBase,
    quantidade,
  }: {
    dataBase: Date;
    quantidade: number;
  }) => {
    const datas: Date[] = [];

    if (quantidade <= 0) return datas;

    if (tipoRecorrenciaEdicao === "semanal") {
      if (diasSemanaRecorrencia.length === 0) return datas;

      const cursor = new Date(dataBase);
      const limiteMaximo = new Date(dataBase);
      limiteMaximo.setFullYear(limiteMaximo.getFullYear() + 2);

      while (cursor <= limiteMaximo && datas.length < quantidade) {
        if (diasSemanaRecorrencia.includes(getDay(cursor))) {
          datas.push(new Date(cursor));
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      return datas;
    }

    const primeiroDia = diasSemanaRecorrencia[0] ?? getDay(dataBase);
    const primeiraData = new Date(dataBase);
    while (getDay(primeiraData) !== primeiroDia) {
      primeiraData.setDate(primeiraData.getDate() + 1);
    }

    datas.push(new Date(primeiraData));
    while (datas.length < quantidade) {
      datas.push(addWeeks(datas[datas.length - 1], Math.max(1, intervaloSemanasRecorrencia)));
    }

    return datas;
  }, [tipoRecorrenciaEdicao, diasSemanaRecorrencia, intervaloSemanasRecorrencia]);

  const construirAtualizacoesRecorrencia = useCallback(() => {
    if (!agendamentoSerieBase?.link_evento || !selectedCliente) {
      return {
        erro: "Dados da série não encontrados.",
        atualizacoes: [] as AtualizacaoRecorrencia[],
        conflitos: [] as ConflitoRecorrencia[],
      };
    }

    if (diasSemanaRecorrencia.length === 0) {
      return {
        erro: "Selecione ao menos um dia da semana.",
        atualizacoes: [] as AtualizacaoRecorrencia[],
        conflitos: [] as ConflitoRecorrencia[],
      };
    }

    const [hora, minuto] = horaRecorrencia.split(":").map(Number);
    if (!Number.isFinite(hora) || !Number.isFinite(minuto) || hora < 0 || hora > 23 || minuto < 0 || minuto > 59) {
      return {
        erro: "Defina um horário válido para a recorrência.",
        atualizacoes: [] as AtualizacaoRecorrencia[],
        conflitos: [] as ConflitoRecorrencia[],
      };
    }

    const agora = new Date();
    const dataCorte = new Date(
      Math.max(agora.getTime(), new Date(agendamentoSerieBase.datetime_start).getTime()),
    );
    const serieOrdenada = agendamentos
      .filter(
        (ag) =>
          ag.link_evento === agendamentoSerieBase.link_evento &&
          ag.nome_cliente.trim().toLowerCase() === selectedCliente.nome.trim().toLowerCase() &&
          !ag.desmarcado,
      )
      .sort((a, b) => new Date(a.datetime_start).getTime() - new Date(b.datetime_start).getTime());

    const futurosDaSerie = serieOrdenada.filter(
      (ag) => new Date(ag.datetime_start) >= dataCorte,
    );

    if (futurosDaSerie.length === 0) {
      return {
        erro: "Não há agendamentos futuros para alterar nesta série.",
        atualizacoes: [] as AtualizacaoRecorrencia[],
        conflitos: [] as ConflitoRecorrencia[],
      };
    }

    const ultimoAntesCorte = [...serieOrdenada]
      .reverse()
      .find((ag) => new Date(ag.datetime_start) < dataCorte);

    const dataBase = ultimoAntesCorte
      ? (() => {
          const inicio = new Date(ultimoAntesCorte.datetime_start);
          inicio.setHours(0, 0, 0, 0);
          inicio.setDate(inicio.getDate() + 1);
          return inicio;
        })()
      : new Date(futurosDaSerie[0].datetime_start);

    const novasDatas = gerarDatasRecorrencia({
      dataBase,
      quantidade: futurosDaSerie.length,
    });

    if (novasDatas.length < futurosDaSerie.length) {
      return {
        erro: "Não foi possível gerar todas as novas datas da recorrência.",
        atualizacoes: [] as AtualizacaoRecorrencia[],
        conflitos: [] as ConflitoRecorrencia[],
      };
    }

    const atualizacoes = futurosDaSerie.map((ag, index) => {
      const novaDataBase = novasDatas[index];
      const novoInicio = new Date(novaDataBase);
      novoInicio.setHours(hora, minuto, 0, 0);

      const duracaoMinutos = ag.tempo_total_minutos || 30;
      const novoFim = new Date(novoInicio.getTime() + duracaoMinutos * 60 * 1000);

      return {
        agendamento: ag,
        novoInicio,
        novoFim,
      };
    });

    const idsQueSeraoMovidos = new Set(atualizacoes.map((item) => item.agendamento.id));
    const conflitos: ConflitoRecorrencia[] = [];

    atualizacoes.forEach((item) => {
      agendamentos.forEach((agExistente) => {
        if (agExistente.desmarcado || idsQueSeraoMovidos.has(agExistente.id)) return;

        const inicioExistente = new Date(agExistente.datetime_start);
        const fimExistente = new Date(agExistente.datetime_end);

        const temSobreposicao = item.novoInicio < fimExistente && item.novoFim > inicioExistente;

        if (temSobreposicao) {
          conflitos.push({
            agendamentoSerie: item.agendamento,
            agendamentoConflito: agExistente,
            novoInicio: item.novoInicio,
            novoFim: item.novoFim,
          });
        }
      });
    });

    return {
      erro: null,
      atualizacoes,
      conflitos,
    };
  }, [
    agendamentoSerieBase,
    selectedCliente,
    diasSemanaRecorrencia,
    horaRecorrencia,
    agendamentos,
    gerarDatasRecorrencia,
  ]);

  const validacaoRecorrencia = useMemo(
    () => construirAtualizacoesRecorrencia(),
    [construirAtualizacoesRecorrencia],
  );

  const handleSalvarRecorrencia = async () => {
    if (!agendamentoSerieBase?.link_evento || !selectedCliente) return;

    if (validacaoRecorrencia.erro) {
      toast.error(validacaoRecorrencia.erro);
      return;
    }

    if (validacaoRecorrencia.conflitos.length > 0) {
      toast.error("Existem conflitos de horário. Ajuste dia/horário antes de salvar.");
      return;
    }

    setIsSavingRecorrencia(true);

    try {
      await Promise.all(
        validacaoRecorrencia.atualizacoes.map(async ({ agendamento, novoInicio, novoFim }) => {

          const { error } = await supabase
            .from("agendamentos")
            .update({
              datetime_start: novoInicio.toISOString(),
              datetime_end: novoFim.toISOString(),
              dia_agendado: format(novoInicio, "yyyy-MM-dd"),
              dia_agendado_formatado: format(novoInicio, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
              hora_agendada: format(novoInicio, "HH:mm"),
              hora_final: format(novoFim, "HH:mm"),
              evento_recorrente: "Sim",
            })
            .eq("id", agendamento.id);

          if (error) throw error;
        }),
      );

      toast.success("Recorrência atualizada para os próximos agendamentos.");
      setShowEditRecorrencia(false);
      setAgendamentoSerieBase(null);
      onRefresh();
    } catch (error) {
      console.error("Erro ao editar recorrência:", error);
      toast.error("Erro ao atualizar a recorrência");
    } finally {
      setIsSavingRecorrencia(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header com busca */}
      <Card className="barber-card border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display text-primary flex items-center gap-2">
            <User className="w-5 h-5" />
            Clientes Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de clientes */}
      <Card className="barber-card border-primary/20">
        <CardContent className="p-0">
          {clientesFiltrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {clientesFiltrados.map((cliente, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectCliente(cliente)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{cliente.nome}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {cliente.telefone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {cliente.telefone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {cliente.totalAgendamentos} agendamento
                      {cliente.totalAgendamentos !== 1 ? "s" : ""}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de detalhes do cliente */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                {selectedCliente?.nome}
              </span>
              <div className="flex items-center gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4 mr-1" />
                      Apagar cliente
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apagar cliente</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso irá remover todos os agendamentos deste cliente. Essa ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteCliente} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Confirmar exclusão
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button variant="outline" size="sm" onClick={handleOpenEdit}>
                  <Edit className="w-4 h-4 mr-1" />
                  Editar
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedCliente && (
            <div className="space-y-4">
              {/* Info do cliente */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedCliente.telefone || "Sem telefone"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Último agendamento: {formatDate(selectedCliente.ultimoAgendamento)}</span>
                </div>
              </div>

              {/* Histórico de agendamentos com filtro por período */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    Histórico de Agendamentos ({agendamentosFiltrados.length}/
                    {agendamentosCliente.length})
                  </h4>
                  <div className="flex gap-1">
                    <Button
                      variant={periodoFiltro === "todos" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPeriodoFiltro("todos")}
                    >
                      Todos
                    </Button>
                    <Button
                      variant={periodoFiltro === "semana" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPeriodoFiltro("semana")}
                    >
                      Semana
                    </Button>
                    <Button
                      variant={periodoFiltro === "mes" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPeriodoFiltro("mes")}
                    >
                      Mês
                    </Button>
                    <Button
                      variant={periodoFiltro === "ano" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPeriodoFiltro("ano")}
                    >
                      Ano
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {agendamentosFiltrados.map((ag) => {
                    const agora = new Date();
                    const isPast = new Date(ag.datetime_start) < agora;
                    const futurosCliente = agendamentosCliente.filter((item) => new Date(item.datetime_start) >= agora);
                    const proximoId = futurosCliente[0]?.id;

                    const statusLabel = ag.desmarcado
                      ? "desmarcado"
                      : isPast
                        ? "concluído"
                        : ag.id === proximoId
                          ? "próximo"
                          : "pendente";

                    const badgeClass = ag.desmarcado
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : isPast
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : ag.id === proximoId
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-sky-500/10 text-sky-400 border-sky-500/30";

                    return (
                      <div
                        key={ag.id}
                        className="p-3 border border-border rounded-lg flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-medium text-sm">{ag.servico}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(ag.dia_agendado)} às {ag.hora_agendada}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${badgeClass}`}
                          >
                            {statusLabel}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => {
                              setSelectedAgendamento(ag);
                              setShowEditAgendamento(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {ag.evento_recorrente === "Sim" && ag.link_evento && !isPast && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              onClick={() => handleOpenEditRecorrencia(ag)}
                              title="Editar recorrência futura"
                            >
                              <Calendar className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {agendamentosFiltrados.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhum agendamento neste período.
                    </p>
                  )}
                </div>
              </div>

              {/* Histórico de mensagens enviadas */}
              <div className="pt-2 border-top border-border/40 space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Histórico de Mensagens Enviadas
                </h4>

                {loadingHistorico ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    Carregando histórico...
                  </p>
                ) : historicoMensagens.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    Nenhuma mensagem enviada ainda para este cliente.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto">
                    {historicoMensagens.map((msg) => (
                      <div
                        key={msg.id}
                        className="border border-border/60 rounded-lg p-3 bg-background/40"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                            {msg.tipo_notificacao}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(msg.enviado_em).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap">
                          {msg.mensagem_enviada}
                        </p>
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-green-500">
                          <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                          {msg.status || "enviada"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de edição de cliente */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>

            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={editTelefone}
                onChange={(e) => setEditTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowEdit(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de edição de agendamento */}
      <EditAppointmentDialog
        open={showEditAgendamento}
        onOpenChange={setShowEditAgendamento}
        agendamento={selectedAgendamento}
        onSuccess={onRefresh}
        onDelete={handleDeleteAgendamento}
        agendamentosExistentes={agendamentos}
      />

      {/* Dialog para editar recorrência futura */}
      <Dialog open={showEditRecorrencia} onOpenChange={setShowEditRecorrencia}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar recorrência futura</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de recorrência</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={tipoRecorrenciaEdicao === "semanal" ? "default" : "outline"}
                  onClick={() => setTipoRecorrenciaEdicao("semanal")}
                >
                  Semanal
                </Button>
                <Button
                  type="button"
                  variant={tipoRecorrenciaEdicao === "personalizado" ? "default" : "outline"}
                  onClick={() => setTipoRecorrenciaEdicao("personalizado")}
                >
                  Personalizado
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dias da semana</Label>
              <div className="grid grid-cols-4 gap-2">
                {diasSemana.map((dia) => (
                  <Button
                    key={dia.valor}
                    type="button"
                    variant={diasSemanaRecorrencia.includes(dia.valor) ? "default" : "outline"}
                    onClick={() => toggleDiaSemanaRecorrencia(dia.valor)}
                    className="h-9"
                  >
                    {dia.label}
                  </Button>
                ))}
              </div>
            </div>

            {tipoRecorrenciaEdicao === "personalizado" && (
              <div className="space-y-2">
                <Label>Repetir a cada X semanas</Label>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={intervaloSemanasRecorrencia}
                  onChange={(e) => setIntervaloSemanasRecorrencia(Math.min(8, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Horário para os próximos agendamentos</Label>
              <Input
                type="time"
                step={900}
                value={horaRecorrencia}
                onChange={(e) => setHoraRecorrencia(e.target.value)}
              />
            </div>

            {validacaoRecorrencia.erro && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {validacaoRecorrencia.erro}
              </div>
            )}

            {validacaoRecorrencia.conflitos.length > 0 && (
              <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive">
                  Conflitos encontrados ({validacaoRecorrencia.conflitos.length})
                </p>
                <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                  {validacaoRecorrencia.conflitos.map((conflito, index) => (
                    <div key={`${conflito.agendamentoSerie.id}-${conflito.agendamentoConflito.id}-${index}`} className="rounded-md border border-destructive/30 bg-background/80 p-2 text-xs space-y-1">
                      <p className="text-foreground">
                        Novo horário da série: {format(conflito.novoInicio, "dd/MM/yyyy HH:mm")} - {format(conflito.novoFim, "HH:mm")}
                      </p>
                      <p className="text-muted-foreground">
                        Já ocupado por {conflito.agendamentoConflito.nome_cliente} ({conflito.agendamentoConflito.servico}) em {format(new Date(conflito.agendamentoConflito.datetime_start), "dd/MM/yyyy HH:mm")}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAgendamento(conflito.agendamentoConflito);
                          setShowEditRecorrencia(false);
                          setShowEditAgendamento(true);
                        }}
                      >
                        Ajustar agendamento em conflito
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ajuste os dias/horário acima ou edite os agendamentos em conflito antes de salvar.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditRecorrencia(false)} disabled={isSavingRecorrencia}>
                Cancelar
              </Button>
              <Button onClick={handleSalvarRecorrencia} disabled={isSavingRecorrencia || !!validacaoRecorrencia.erro || validacaoRecorrencia.conflitos.length > 0}>
                {isSavingRecorrencia ? "Salvando..." : "Salvar recorrência"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
