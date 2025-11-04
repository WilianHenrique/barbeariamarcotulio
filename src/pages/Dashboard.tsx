import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LogOut, Calendar, Clock, User, Scissors } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Agendamento {
  id: string;
  id_evento: string;
  nome_cliente: string;
  datetime_start: string;
  datetime_end: string;
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

  useEffect(() => {
    checkAuth();
    loadAgendamentos();

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

  const getTempoRestante = (datetime: string) => {
    const now = new Date();
    const agendamento = new Date(datetime);
    const diff = agendamento.getTime() - now.getTime();
    
    if (diff < 0) return "Passou";
    
    const horas = Math.floor(diff / (1000 * 60 * 60));
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${horas}h ${minutos}m`;
  };

  const getNotificacaoStatus = (agendamento: Agendamento) => {
    const now = new Date();
    const datetime = new Date(agendamento.datetime_start);
    const diff = datetime.getTime() - now.getTime();
    const horasRestantes = diff / (1000 * 60 * 60);

    if (horasRestantes < 1 && !agendamento.notificacao_1h_enviada) {
      return <Badge variant="destructive">Notificação 1h pendente</Badge>;
    } else if (horasRestantes < 24 && !agendamento.notificacao_24h_enviada) {
      return <Badge className="bg-accent">Notificação 24h pendente</Badge>;
    } else if (agendamento.notificacao_1h_enviada) {
      return <Badge variant="secondary">Notificações enviadas</Badge>;
    } else {
      return <Badge variant="outline">Aguardando</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-r from-card to-card/80 border-border shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-primary rounded-full p-3">
                  <Scissors className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-3xl font-bold text-foreground">
                    Sistema de Agendamentos
                  </CardTitle>
                  <p className="text-muted-foreground">Gerenciamento de notificações</p>
                </div>
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="border-border hover:bg-secondary"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Agendamentos</p>
                  <p className="text-3xl font-bold text-foreground">{agendamentos.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Próximas 24h</p>
                  <p className="text-3xl font-bold text-foreground">
                    {agendamentos.filter(a => {
                      const diff = new Date(a.datetime_start).getTime() - new Date().getTime();
                      return diff > 0 && diff < 24 * 60 * 60 * 1000;
                    }).length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-3xl font-bold text-foreground">
                    {agendamentos.filter(a => !a.notificacao_1h_enviada).length}
                  </p>
                </div>
                <User className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Agendamentos */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Agendamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-secondary/50">
                  <TableHead className="text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-muted-foreground">Data</TableHead>
                  <TableHead className="text-muted-foreground">Horário</TableHead>
                  <TableHead className="text-muted-foreground">Serviço</TableHead>
                  <TableHead className="text-muted-foreground">Tempo Restante</TableHead>
                  <TableHead className="text-muted-foreground">Status Notificação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : agendamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhum agendamento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  agendamentos.map((agendamento) => (
                    <TableRow key={agendamento.id} className="border-border hover:bg-secondary/50">
                      <TableCell className="font-medium text-foreground">
                        {agendamento.nome_cliente}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {agendamento.dia_agendado_formatado}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {agendamento.hora_agendada} - {agendamento.hora_final}
                      </TableCell>
                      <TableCell className="text-foreground">{agendamento.servico}</TableCell>
                      <TableCell className="text-foreground font-mono">
                        {getTempoRestante(agendamento.datetime_start)}
                      </TableCell>
                      <TableCell>{getNotificacaoStatus(agendamento)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;