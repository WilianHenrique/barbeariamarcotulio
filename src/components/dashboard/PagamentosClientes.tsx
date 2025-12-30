import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, DollarSign, Clock, CheckCircle, AlertCircle, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Agendamento {
  id: string;
  nome_cliente: string;
  telefone_cliente: string | null;
  datetime_start: string;
  servico: string;
  pagamento_pendente: boolean;
  lembrete_pagamento_enviado: boolean;
  valor_servico: number | null;
  enviar_notificacao_cobranca: boolean;
}

interface ClientePagamento {
  nome: string;
  telefone: string | null;
  ultimoAgendamento: Agendamento;
  totalPendente: number;
}

export const PagamentosClientes = () => {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [clientesAgrupados, setClientesAgrupados] = useState<ClientePagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "pendentes" | "pagos">("todos");
  const [valoresEdicao, setValoresEdicao] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAgendamentos();
    
    const channel = supabase
      .channel('pagamentos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => {
        loadAgendamentos();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadAgendamentos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar agendamentos passados (já realizados)
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('user_id', user.id)
        .lt('datetime_start', now)
        .order('datetime_start', { ascending: false });

      if (error) throw error;

      setAgendamentos(data || []);
      agruparClientes(data || []);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const agruparClientes = (agendamentosData: Agendamento[]) => {
    const clientesMap = new Map<string, ClientePagamento>();

    agendamentosData.forEach((ag) => {
      const key = ag.nome_cliente.toLowerCase();
      
      if (!clientesMap.has(key)) {
        clientesMap.set(key, {
          nome: ag.nome_cliente,
          telefone: ag.telefone_cliente,
          ultimoAgendamento: ag,
          totalPendente: 0,
        });
      }

      const cliente = clientesMap.get(key)!;
      
      // Atualizar último agendamento se for mais recente
      if (new Date(ag.datetime_start) > new Date(cliente.ultimoAgendamento.datetime_start)) {
        cliente.ultimoAgendamento = ag;
      }

      // Somar valores pendentes
      if (ag.pagamento_pendente && ag.valor_servico) {
        cliente.totalPendente += ag.valor_servico;
      }
    });

    const clientes = Array.from(clientesMap.values()).sort((a, b) => 
      b.totalPendente - a.totalPendente
    );

    setClientesAgrupados(clientes);
  };

  const togglePagamentoPendente = async (agendamentoId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ 
          pagamento_pendente: !currentStatus,
          lembrete_pagamento_enviado: false // Reset lembrete ao marcar/desmarcar
        })
        .eq('id', agendamentoId);

      if (error) throw error;

      toast.success(
        !currentStatus 
          ? 'Pagamento marcado como pendente' 
          : 'Pagamento marcado como pago'
      );
      
      loadAgendamentos();
    } catch (error) {
      console.error('Erro ao atualizar status de pagamento:', error);
      toast.error('Erro ao atualizar pagamento');
    }
  };

  const toggleNotificacaoCobranca = async (agendamentoId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ enviar_notificacao_cobranca: !currentStatus })
        .eq('id', agendamentoId);

      if (error) throw error;

      toast.success(
        !currentStatus 
          ? 'Notificação de cobrança ativada' 
          : 'Notificação de cobrança desativada'
      );
      
      loadAgendamentos();
    } catch (error) {
      console.error('Erro ao atualizar notificação:', error);
      toast.error('Erro ao atualizar notificação');
    }
  };

  const updateValorServico = async (agendamentoId: string, valor: number) => {
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ valor_servico: valor })
        .eq('id', agendamentoId);

      if (error) throw error;

      toast.success('Valor atualizado');
      loadAgendamentos();
    } catch (error) {
      console.error('Erro ao atualizar valor:', error);
      toast.error('Erro ao atualizar valor');
    }
  };

  const clientesFiltrados = clientesAgrupados.filter((c) => {
    const matchNome = c.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const agendamentoPendente = c.ultimoAgendamento.pagamento_pendente;
    
    if (filtroStatus === "pendentes") {
      return matchNome && agendamentoPendente;
    } else if (filtroStatus === "pagos") {
      return matchNome && !agendamentoPendente;
    }
    
    return matchNome;
  });

  const totalGeralPendente = clientesAgrupados.reduce((sum, c) => sum + c.totalPendente, 0);
  const totalClientesPendentes = clientesAgrupados.filter((c) => c.totalPendente > 0).length;
  const totalClientesPagos = clientesAgrupados.filter((c) => c.totalPendente === 0).length;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="elegant-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-accent/10">
                <DollarSign className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pendente</p>
                <p className="text-2xl font-bold text-accent">
                  R$ {totalGeralPendente.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="elegant-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-500/10">
                <AlertCircle className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clientes Pendentes</p>
                <p className="text-2xl font-bold text-foreground">{totalClientesPendentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="elegant-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clientes Pagos</p>
                <p className="text-2xl font-bold text-foreground">{totalClientesPagos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-refined pl-10"
          />
        </div>

        <Select value={filtroStatus} onValueChange={(value: any) => setFiltroStatus(value)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            <SelectItem value="pendentes">Apenas pendentes</SelectItem>
            <SelectItem value="pagos">Apenas pagos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clientes List */}
      <Card className="elegant-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Controle de Pagamentos
          </CardTitle>
          <CardDescription>
            Gerencie pagamentos pendentes e envie lembretes automáticos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum cliente encontrado
            </div>
          ) : (
            <div className="space-y-4">
              {clientesFiltrados.map((cliente) => {
                const ag = cliente.ultimoAgendamento;
                const dataAgendamento = parse(ag.datetime_start.split('T')[0], 'yyyy-MM-dd', new Date());
                
                return (
                  <div
                    key={ag.id}
                    className="p-4 border border-border/50 rounded-lg hover:bg-accent/5 transition-colors space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-lg text-foreground">{cliente.nome}</h3>
                        <p className="text-sm text-muted-foreground">
                          Último agendamento: {format(dataAgendamento, "dd/MM/yyyy", { locale: ptBR })} - {ag.servico}
                        </p>
                        {cliente.telefone && (
                          <p className="text-sm text-muted-foreground">
                            📱 {cliente.telefone}
                          </p>
                        )}
                      </div>
                      
                      {ag.pagamento_pendente ? (
                        <Badge variant="destructive" className="text-sm">
                          {ag.valor_servico ? `R$ ${ag.valor_servico.toFixed(2)} pendente` : 'Pagamento pendente'}
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-500 text-white text-sm">
                          ✓ Pago
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/30">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`pagamento-${ag.id}`}
                          checked={ag.pagamento_pendente}
                          onCheckedChange={() => togglePagamentoPendente(ag.id, ag.pagamento_pendente)}
                        />
                        <label
                          htmlFor={`pagamento-${ag.id}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          Marcar como pendente
                        </label>
                      </div>

                      {ag.pagamento_pendente && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Valor:</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="0,00"
                              value={valoresEdicao[ag.id] ?? (ag.valor_servico !== null ? ag.valor_servico.toString() : "")}
                              onChange={(e) => {
                                const valorStr = e.target.value.replace(/,/g, '.');
                                if (/^\d*(\.\d{0,2})?$/.test(valorStr)) {
                                  setValoresEdicao((prev) => ({ ...prev, [ag.id]: e.target.value }));
                                }
                              }}
                              onBlur={() => {
                                const valorStr = (valoresEdicao[ag.id] ?? "").replace(/,/g, '.');
                                const valor = parseFloat(valorStr);
                                if (!isNaN(valor) && valor !== ag.valor_servico) {
                                  updateValorServico(ag.id, valor);
                                }
                              }}
                              className="w-24 h-8 text-sm"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`notificacao-${ag.id}`}
                              checked={ag.enviar_notificacao_cobranca}
                              onCheckedChange={() => toggleNotificacaoCobranca(ag.id, ag.enviar_notificacao_cobranca)}
                            />
                            <label
                              htmlFor={`notificacao-${ag.id}`}
                              className="text-sm font-medium cursor-pointer"
                            >
                              Notificação de cobrança
                            </label>
                          </div>

                          {ag.lembrete_pagamento_enviado && (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              Lembrete enviado
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
