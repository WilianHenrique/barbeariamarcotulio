import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sidebar } from "@/components/layout/Sidebar";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { WeeklyCalendar } from "@/components/dashboard/WeeklyCalendar";
import { AppointmentDialog } from "@/components/dashboard/AppointmentDialog";
import { EditAppointmentDialog } from "@/components/dashboard/EditAppointmentDialog";
import { AppointmentList } from "@/components/dashboard/AppointmentList";
import { MensagensAgendadas } from "@/components/dashboard/MensagensAgendadas";
import { RelatorioGeral } from "@/components/dashboard/RelatorioGeral";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const agendamentosPendentes = agendamentosFuturos.filter(a => !(a.notificacao_24h_enviada && a.notificacao_1h_enviada));
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
                {activeTab === "relatorios" && "Relatórios"}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {activeTab === "agenda" && "Visualize e gerencie seus agendamentos"}
                {activeTab === "pendentes" && "Agendamentos que aguardam confirmação"}
                {activeTab === "mensagens" && "Configure suas mensagens de notificação"}
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
            <div className="h-[calc(100vh-320px)] min-h-[500px]">
              <WeeklyCalendar
                agendamentos={agendamentos}
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
