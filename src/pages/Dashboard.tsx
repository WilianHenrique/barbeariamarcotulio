import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Scissors, Settings as SettingsIcon, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { MetricsCards } from "@/components/dashboard/MetricsCards";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { AgendamentosTable } from "@/components/dashboard/AgendamentosTable";
import { ClienteHistorico } from "@/components/dashboard/ClienteHistorico";
import { RelatorioGeral } from "@/components/dashboard/RelatorioGeral";

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
  notificacao_24h_enviada: boolean;
  notificacao_1h_enviada: boolean;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  useEffect(() => {
    checkAuth();
    loadAgendamentos();

    // Atualiza a cada segundo para re-renderizar o tempo restante em tempo real
    const interval = setInterval(() => setNow(Date.now()), 1000);

    const channel = supabase
      .channel('agendamentos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agendamentos'
        },
        () => {
          loadAgendamentos();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const loadAgendamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .order('datetime_start', { ascending: true });

      if (error) throw error;
      setAgendamentos(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar agendamentos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleDelete = async (id: string, nomeCliente: string) => {
    if (!confirm(`Tem certeza que deseja excluir o agendamento de ${nomeCliente}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      // Remover imediatamente da lista para feedback instantâneo
      setAgendamentos((prev) => prev.filter((a) => a.id !== id));
      toast.success("Agendamento excluído com sucesso");
    } catch (error: any) {
      toast.error("Erro ao excluir agendamento");
    }
  };

  const getTempoRestante = (datetime: string) => {
    const target = new Date(datetime).getTime();
    const diff = target - now; // usa estado atualizado a cada segundo

    if (diff <= 0) return "0s";

    const totalSeconds = Math.floor(diff / 1000);
    const horas = Math.floor(totalSeconds / 3600);
    const minutos = Math.floor((totalSeconds % 3600) / 60);
    const segundos = totalSeconds % 60;

    const s = segundos.toString().padStart(2, '0');
    if (horas > 0) return `${horas}h ${minutos}m ${s}s`;
    if (minutos > 0) return `${minutos}m ${s}s`;
    return `${s}s`;
  };

  const getNotificacaoStatus = (agendamento: Agendamento) => {
    const datetime = new Date(agendamento.datetime_start);
    const diff = datetime.getTime() - now;
    const horasRestantes = diff / (1000 * 60 * 60);

    // Se ambas notificações já foram enviadas
    if (agendamento.notificacao_24h_enviada && agendamento.notificacao_1h_enviada) {
      return <Badge variant="secondary">Notificações enviadas</Badge>;
    }

    // Se falta menos de 1h e notificação de 1h ainda não foi enviada
    if (horasRestantes < 1 && !agendamento.notificacao_1h_enviada) {
      const tempoAte1h = datetime.getTime() - now;
      if (tempoAte1h <= 0) return <Badge variant="destructive">Processando...</Badge>;
      
      const totalSeconds = Math.floor(tempoAte1h / 1000);
      const minutos = Math.floor(totalSeconds / 60);
      const segundos = totalSeconds % 60;
      
      return (
        <Badge variant="destructive" className="font-mono">
          Notificação em: {minutos}m {segundos.toString().padStart(2, '0')}s
        </Badge>
      );
    }

    // Se falta menos de 24h e notificação de 24h ainda não foi enviada
    if (horasRestantes < 24 && !agendamento.notificacao_24h_enviada) {
      const tempoAte24h = datetime.getTime() - 24 * 60 * 60 * 1000 - now;
      if (tempoAte24h <= 0) return <Badge className="bg-accent">Processando...</Badge>;
      
      const totalSeconds = Math.floor(tempoAte24h / 1000);
      const horas = Math.floor(totalSeconds / 3600);
      const minutos = Math.floor((totalSeconds % 3600) / 60);
      const segundos = totalSeconds % 60;
      
      return (
        <Badge className="bg-accent font-mono">
          Notificação em: {horas}h {minutos}m {segundos.toString().padStart(2, '0')}s
        </Badge>
      );
    }

    // Se falta mais de 24h
    return <Badge variant="outline">Aguardando</Badge>;
  };

  // Filtragem por período
  const filterByPeriod = (agendamentos: Agendamento[]) => {
    const now = new Date();
    return agendamentos.filter(a => {
      const dataAgendamento = new Date(a.dia_agendado);
      
      switch (periodFilter) {
        case "today":
          return dataAgendamento.toDateString() === now.toDateString();
        case "week":
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          return dataAgendamento >= weekAgo;
        case "month":
          return dataAgendamento.getMonth() === now.getMonth() && 
                 dataAgendamento.getFullYear() === now.getFullYear();
        case "year":
          return dataAgendamento.getFullYear() === now.getFullYear();
        default:
          return true;
      }
    });
  };

  // Filtragem por busca
  const filterBySearch = (agendamentos: Agendamento[]) => {
    if (!searchTerm) return agendamentos;
    return agendamentos.filter(a => 
      a.nome_cliente.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const agendamentosFiltrados = filterBySearch(filterByPeriod(agendamentos));
  
  const agendamentosPendentes = agendamentosFiltrados.filter(
    a => !(a.notificacao_24h_enviada && a.notificacao_1h_enviada)
  );

  const agendamentosRealizados = agendamentosFiltrados.filter(
    a => a.notificacao_24h_enviada && a.notificacao_1h_enviada
  );

  // Histórico do cliente selecionado
  const clienteSelecionado = searchTerm ? agendamentos.filter(a => 
    a.nome_cliente.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  // Métricas
  const totalMes = agendamentos.filter(a => {
    const data = new Date(a.dia_agendado);
    const now = new Date();
    return data.getMonth() === now.getMonth() && data.getFullYear() === now.getFullYear();
  }).length;

  const proximas24h = agendamentosPendentes.filter(a => {
    const diff = new Date(a.datetime_start).getTime() - new Date().getTime();
    return diff > 0 && diff < 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <Card className="barber-card border-primary/20">
          <CardHeader className="bg-gradient-to-r from-card via-card/95 to-primary/5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-primary to-primary/80 rounded-lg p-3 shadow-glow">
                  <Scissors className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-2xl sm:text-3xl font-display font-bold text-primary tracking-wide">
                    Barbearia Marco Túlio
                  </CardTitle>
                  <p className="text-muted-foreground text-sm sm:text-base">Sistema de Gestão de Agendamentos</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => navigate("/settings")}
                  variant="outline"
                  size="sm"
                  className="border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
                >
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  Configurações
                </Button>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="border-accent/30 hover:bg-accent/10 hover:border-accent/50 transition-all"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Métricas */}
        <MetricsCards
          totalAgendamentos={agendamentosPendentes.length}
          proximas24h={proximas24h}
          realizados={agendamentosRealizados.length}
          totalMes={totalMes}
        />

        {/* Barra de Filtros */}
        <Card className="barber-card border-primary/20">
          <CardHeader>
            <FilterBar
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              periodFilter={periodFilter}
              setPeriodFilter={setPeriodFilter}
            />
          </CardHeader>
        </Card>

        {/* Histórico do Cliente */}
        {searchTerm && clienteSelecionado.length > 0 && (
          <ClienteHistorico
            clienteNome={clienteSelecionado[0].nome_cliente}
            agendamentos={clienteSelecionado}
          />
        )}

        {/* Tabs de Navegação */}
        <Tabs defaultValue="pendentes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-card border border-border/50">
            <TabsTrigger value="pendentes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Pendentes ({agendamentosPendentes.length})
            </TabsTrigger>
            <TabsTrigger value="realizados" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Realizados ({agendamentosRealizados.length})
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="mr-2 h-4 w-4" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="space-y-4">
            <Card className="barber-card border-primary/20">
              <CardHeader className="border-b border-primary/10">
                <CardTitle className="text-xl font-display text-primary">Agendamentos Pendentes</CardTitle>
              </CardHeader>
              <div className="p-6">
                <AgendamentosTable
                  agendamentos={agendamentosPendentes}
                  isLoading={isLoading}
                  now={now}
                  getTempoRestante={getTempoRestante}
                  getNotificacaoStatus={getNotificacaoStatus}
                  handleDelete={handleDelete}
                  emptyMessage="Nenhum agendamento pendente"
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="realizados" className="space-y-4">
            <Card className="barber-card border-primary/20">
              <CardHeader className="border-b border-primary/10">
                <CardTitle className="text-xl font-display text-primary">Agendamentos Realizados</CardTitle>
              </CardHeader>
              <div className="p-6">
                <AgendamentosTable
                  agendamentos={agendamentosRealizados}
                  isLoading={isLoading}
                  now={now}
                  getTempoRestante={getTempoRestante}
                  getNotificacaoStatus={getNotificacaoStatus}
                  handleDelete={handleDelete}
                  emptyMessage="Nenhum agendamento realizado"
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="relatorios" className="space-y-6">
            <RelatorioGeral agendamentos={agendamentos} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;