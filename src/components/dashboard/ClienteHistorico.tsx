import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckCircle2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Separator } from "@/components/ui/separator";

interface Agendamento {
  id: string;
  nome_cliente: string;
  dia_agendado_formatado: string;
  hora_agendada: string;
  servico: string;
  notificacao_24h_enviada: boolean;
  notificacao_1h_enviada: boolean;
  datetime_start: string;
}

interface HistoricoMensagem {
  id: string;
  tipo_notificacao: string;
  mensagem_enviada: string;
  enviado_em: string;
  status: string;
}

interface ClienteHistoricoProps {
  clienteNome: string;
  agendamentos: Agendamento[];
}

export const ClienteHistorico = ({ clienteNome, agendamentos }: ClienteHistoricoProps) => {
  const [historicoMensagens, setHistoricoMensagens] = useState<HistoricoMensagem[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);

  useEffect(() => {
    if (clienteNome) {
      loadHistoricoMensagens();
    }
  }, [clienteNome]);

  const loadHistoricoMensagens = async () => {
    try {
      const { data, error } = await supabase
        .from("historico_mensagens")
        .select("*")
        .eq("nome_cliente", clienteNome)
        .order("enviado_em", { ascending: false });

      if (error) throw error;
      if (data) setHistoricoMensagens(data);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoadingHistorico(false);
    }
  };

  if (!clienteNome || agendamentos.length === 0) {
    return null;
  }

  const totalAgendamentos = agendamentos.length;
  const agora = new Date();
  const realizados = agendamentos.filter(a => {
    const dataEvento = new Date(a.datetime_start);
    return dataEvento < agora && a.notificacao_24h_enviada && a.notificacao_1h_enviada;
  }).length;

  return (
    <div className="space-y-6">
      <Card className="barber-card border-primary/20">
        <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-card via-card/95 to-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-display text-primary">Histórico do Cliente</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{clienteNome}</p>
            </div>
            <div className="flex gap-4">
              <div className="text-right">
                <p className="text-2xl font-display font-bold text-primary">{totalAgendamentos}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-display font-bold text-accent">{realizados}</p>
                <p className="text-xs text-muted-foreground">Realizados</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-card/50 border-border hover:bg-card/70">
                  <TableHead className="text-muted-foreground font-semibold">Data</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Horário</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Serviço</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agendamentos.map((agendamento) => {
                  const dataEvento = new Date(agendamento.datetime_start);
                  const jaAconteceu = dataEvento < agora;
                  
                  return (
                    <TableRow key={agendamento.id} className="border-border/50 hover:bg-card/30">
                      <TableCell className="font-medium">{agendamento.dia_agendado_formatado}</TableCell>
                      <TableCell>{agendamento.hora_agendada}</TableCell>
                      <TableCell>{agendamento.servico}</TableCell>
                      <TableCell>
                        {jaAconteceu ? (
                          agendamento.notificacao_24h_enviada && agendamento.notificacao_1h_enviada ? (
                            <Badge variant="secondary">Realizado</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                              Parcial
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline">Pendente</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="barber-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Histórico de Mensagens Enviadas
          </CardTitle>
          <CardDescription>
            Todas as notificações enviadas para {clienteNome}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistorico ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Carregando histórico...
            </p>
          ) : historicoMensagens.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma mensagem enviada ainda
            </p>
          ) : (
            <div className="space-y-4">
              {historicoMensagens.map((msg) => (
                <div key={msg.id} className="border border-border/50 rounded-lg p-4 bg-background/30">
                  <div className="flex items-start justify-between mb-2">
                    <Badge 
                      variant="outline" 
                      className={
                        msg.tipo_notificacao.includes("24 horas")
                          ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                          : "bg-purple-500/10 text-purple-500 border-purple-500/20"
                      }
                    >
                      {msg.tipo_notificacao}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(msg.enviado_em).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                    {msg.mensagem_enviada}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-green-500">Enviada</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
