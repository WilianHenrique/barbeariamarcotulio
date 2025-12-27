import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sidebar } from "@/components/layout/Sidebar";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { WeeklyCalendar } from "@/components/dashboard/WeeklyCalendar";
import { AppointmentDialog } from "@/components/dashboard/AppointmentDialog";
import { EditAppointmentDialog } from "@/components/dashboard/EditAppointmentDialog";
import { BuscadorHorarios } from "@/components/dashboard/BuscadorHorarios";
import { AppointmentList } from "@/components/dashboard/AppointmentList";
import { MensagensAgendadas } from "@/components/dashboard/MensagensAgendadas";
import { RelatorioGeral } from "@/components/dashboard/RelatorioGeral";
import { ClientesList } from "@/components/dashboard/ClientesList";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startOfDay } from "date-fns";

interface Agendamento {
  id: string;
  id_evento: string;
  nome_cliente: string;
  datetime_start: string;
  datetime_end: string;
  dia_agendado: string;
  dia_agendado_formatado: string;
  hora_agendada: string;
  hora_final: string;
  servico: string;
  tempo_total_minutos: number;
  status_evento: string;
  telefone_cliente?: string | null;
  notificacao_24h_enviada: boolean;
  notificacao_1h_enviada: boolean;
  evento_recorrente: string;
  link_evento: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("agenda");
  const [showNovoAgendamento, setShowNovoAgendamento] = useState(false);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  useEffect(() => {
    checkAuth();
    loadAgendamentos();
    executarVerificacaoNotificacoes();

    const channel = supabase
      .channel('agendamentos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => {
        loadAgendamentos();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/auth");
  };

  const loadAgendamentos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('user_id', user.id)
        .order('datetime_start', { ascending: true });

      if (error) throw error;
      setAgendamentos(data || []);
    } catch (error) {
      toast.error("Erro ao carregar agendamentos");
    } finally {
      setIsLoading(false);
    }
  };

  const executarVerificacaoNotificacoes = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('processar-notificacoes', {
        body: {},
      });

      if (error) {
        console.error('Erro ao executar verificação de notificações:', error);
        toast.error('Erro ao verificar notificações automáticas');
        return;
      }

      if (data?.notificacoesEnviadas) {
        console.log('Notificações enviadas:', data.notificacoesEnviadas);
      }
    } catch (err) {
      console.error('Erro inesperado ao executar verificação de notificações:', err);
    }
  };

  const handleDelete = async (id: string, nomeCliente: string) => {
    if (!confirm(`Excluir o agendamento de ${nomeCliente}?`)) return;

    try {
      const { error } = await supabase.from('agendamentos').delete().eq('id', id);
      if (error) throw error;
      setAgendamentos((prev) => prev.filter((a) => a.id !== id));
      toast.success("Agendamento excluído");
    } catch (error) {
      toast.error("Erro ao excluir agendamento");
    }
  };

  const handleDeleteDirect = async (id: string, nomeCliente: string) => {
    try {
      const { error } = await supabase.from('agendamentos').delete().eq('id', id);
      if (error) throw error;
      setAgendamentos((prev) => prev.filter((a) => a.id !== id));
      toast.success("Agendamento excluído");
    } catch (error) {
      toast.error("Erro ao excluir agendamento");
    }
  };

  const handleSelectAgendamento = (agendamento: Agendamento) => {
    setAgendamentoSelecionado(agendamento);
    setShowEditDialog(true);
  };

  // Filtros
  const agendamentosFiltrados = searchTerm 
    ? agendamentos.filter(a => a.nome_cliente.toLowerCase().includes(searchTerm.toLowerCase()))
    : agendamentos;

  const agendamentosFuturos = agendamentosFiltrados.filter(a => new Date(a.datetime_start) > new Date());
  const agendamentosPendentesBase = agendamentosFuturos.filter(a => !(a.notificacao_24h_enviada && a.notificacao_1h_enviada));

  // Para séries recorrentes, mostrar apenas o próximo agendamento de cada série
  const gruposPendentes = agendamentosPendentesBase.reduce((acc, ag) => {
    const chave = ag.evento_recorrente === 'Sim' && ag.link_evento
      ? ag.link_evento
      : ag.id;
    if (!acc[chave]) acc[chave] = [];
    acc[chave].push(ag);
    return acc;
  }, {} as Record<string, Agendamento[]>);

  const agora = new Date();
  const agendamentosPendentes = Object.values(gruposPendentes)
    .map((grupo) => {
      const futuros = grupo.filter(a => new Date(a.datetime_start) >= agora);
      if (futuros.length === 0) return null;
      futuros.sort((a, b) => new Date(a.datetime_start).getTime() - new Date(b.datetime_start).getTime());
      return futuros[0];
    })
    .filter((a): a is Agendamento => a !== null)
    .sort((a, b) => new Date(a.datetime_start).getTime() - new Date(b.datetime_start).getTime());

  const agendamentosRealizados = agendamentosFiltrados.filter(a => a.notificacao_24h_enviada && a.notificacao_1h_enviada);

  // Métricas
  const totalMes = agendamentos.filter(a => {
    const data = new Date(a.dia_agendado);
    const now = new Date();
    return data.getMonth() === now.getMonth() && data.getFullYear() === now.getFullYear();
  }).length;

  const proximas24h = agendamentosPendentes.filter(a => {
    const diff = new Date(a.datetime_start).getTime() - Date.now();
    return diff > 0 && diff < 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-12 lg:pt-0">
            <div>
              <h1 className="font-display text-2xl text-foreground">
                {activeTab === "agenda" && "Agenda"}
                {activeTab === "pendentes" && "Agendamentos Pendentes"}
                {activeTab === "mensagens" && "Mensagens"}
                {activeTab === "clientes" && "Clientes"}
                {activeTab === "relatorios" && "Relatórios"}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {activeTab === "agenda" && "Visualize e gerencie seus agendamentos"}
                {activeTab === "pendentes" && "Agendamentos que aguardam confirmação"}
                {activeTab === "mensagens" && "Configure suas mensagens de notificação"}
                {activeTab === "clientes" && "Gerencie sua lista de clientes"}
                {activeTab === "relatorios" && "Acompanhe o desempenho da barbearia"}
              </p>
            </div>
            
            {(activeTab === "agenda" || activeTab === "pendentes") && (
              <Button onClick={() => setShowNovoAgendamento(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Novo Agendamento
              </Button>
            )}
          </div>

          {/* Quick Stats */}
          <QuickStats 
            totalPendentes={agendamentosPendentes.length}
            proximas24h={proximas24h}
            realizados={agendamentosRealizados.length}
            totalMes={totalMes}
          />

          {/* Content based on active tab */}
          {activeTab === "agenda" && (
            <div className="space-y-6">
              <BuscadorHorarios
                agendamentos={agendamentos}
                onSelecionarHorario={(data, horario) => {
                  toast.success(`Horário ${horario} selecionado!`);
                  setShowNovoAgendamento(true);
                }}
              />
              
              <WeeklyCalendar
                agendamentos={agendamentos.filter(a => new Date(a.datetime_start) >= startOfDay(new Date()))}
                onNovoAgendamento={() => setShowNovoAgendamento(true)}
                onSelecionarAgendamento={handleSelectAgendamento}
              />
            </div>
          )}


          {activeTab === "pendentes" && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-refined pl-10"
                />
              </div>
              
              <div className="elegant-card p-4 sm:p-6">
                <AppointmentList
                  agendamentos={agendamentosPendentes}
                  isLoading={isLoading}
                  onDelete={handleDelete}
                  onSelect={handleSelectAgendamento}
                  emptyMessage="Nenhum agendamento pendente"
                />
              </div>
            </div>
          )}

          {activeTab === "mensagens" && (
            <MensagensAgendadas />
          )}

          {activeTab === "clientes" && (
            <ClientesList 
              agendamentos={agendamentos} 
              onRefresh={loadAgendamentos}
            />
          )}

          {activeTab === "relatorios" && (
            <RelatorioGeral agendamentos={agendamentos} />
          )}
        </div>
      </main>

      {/* Dialogs */}
      <AppointmentDialog
        open={showNovoAgendamento}
        onOpenChange={setShowNovoAgendamento}
        onSuccess={loadAgendamentos}
        agendamentosExistentes={agendamentos}
      />

      <EditAppointmentDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        agendamento={agendamentoSelecionado}
        onSuccess={loadAgendamentos}
        onDelete={handleDeleteDirect}
        agendamentosExistentes={agendamentos}
      />
    </div>
  );
};

export default Dashboard;
