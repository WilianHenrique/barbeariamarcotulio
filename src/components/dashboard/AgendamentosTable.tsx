import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface Agendamento {
  id: string;
  nome_cliente: string;
  dia_agendado_formatado: string;
  hora_agendada: string;
  hora_final: string;
  servico: string;
  datetime_start: string;
  notificacao_24h_enviada: boolean;
  notificacao_1h_enviada: boolean;
}

interface AgendamentosTableProps {
  agendamentos: Agendamento[];
  isLoading: boolean;
  now: number;
  getTempoRestante: (datetime: string) => string;
  getNotificacaoStatus: (agendamento: Agendamento) => JSX.Element;
  handleDelete: (id: string, nomeCliente: string) => void;
  emptyMessage: string;
}

export const AgendamentosTable = ({
  agendamentos,
  isLoading,
  now,
  getTempoRestante,
  getNotificacaoStatus,
  handleDelete,
  emptyMessage
}: AgendamentosTableProps) => {
  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-card/50 border-border hover:bg-card/70">
            <TableHead className="text-muted-foreground font-semibold">Cliente</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Data</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Horário</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Serviço</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Tempo Restante</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Status Notificação</TableHead>
            <TableHead className="text-muted-foreground font-semibold text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Carregando...
              </TableCell>
            </TableRow>
          ) : agendamentos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            agendamentos.map((agendamento) => (
              <TableRow key={agendamento.id} className="border-border/50 hover:bg-card/30 transition-colors">
                <TableCell className="font-semibold text-foreground">
                  {agendamento.nome_cliente}
                </TableCell>
                <TableCell className="text-foreground/90">
                  {agendamento.dia_agendado_formatado}
                </TableCell>
                <TableCell className="text-foreground/90">
                  {agendamento.hora_agendada} - {agendamento.hora_final}
                </TableCell>
                <TableCell className="text-foreground/90">{agendamento.servico}</TableCell>
                <TableCell className="text-foreground/90 font-mono text-sm">
                  {getTempoRestante(agendamento.datetime_start)}
                </TableCell>
                <TableCell>{getNotificacaoStatus(agendamento)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(agendamento.id, agendamento.nome_cliente)}
                    className="hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
