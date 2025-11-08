import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Agendamento {
  id: string;
  nome_cliente: string;
  dia_agendado_formatado: string;
  hora_agendada: string;
  servico: string;
  notificacao_24h_enviada: boolean;
  notificacao_1h_enviada: boolean;
}

interface ClienteHistoricoProps {
  clienteNome: string;
  agendamentos: Agendamento[];
}

export const ClienteHistorico = ({ clienteNome, agendamentos }: ClienteHistoricoProps) => {
  if (!clienteNome || agendamentos.length === 0) {
    return null;
  }

  const totalAgendamentos = agendamentos.length;
  const realizados = agendamentos.filter(a => a.notificacao_24h_enviada && a.notificacao_1h_enviada).length;

  return (
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
              {agendamentos.map((agendamento) => (
                <TableRow key={agendamento.id} className="border-border/50 hover:bg-card/30">
                  <TableCell className="font-medium">{agendamento.dia_agendado_formatado}</TableCell>
                  <TableCell>{agendamento.hora_agendada}</TableCell>
                  <TableCell>{agendamento.servico}</TableCell>
                  <TableCell>
                    {agendamento.notificacao_24h_enviada && agendamento.notificacao_1h_enviada ? (
                      <Badge variant="secondary">Realizado</Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
