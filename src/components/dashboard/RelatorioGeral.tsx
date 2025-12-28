import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Agendamento {
  dia_agendado: string;
  servico: string;
  evento_recorrente: string;
  datetime_start: string;
}

interface Servico {
  nome: string;
  preco_normal: number;
  preco_fidelidade: number;
}

interface RelatorioGeralProps {
  agendamentos: Agendamento[];
}

export const RelatorioGeral = ({ agendamentos }: RelatorioGeralProps) => {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [periodoGanhos, setPeriodoGanhos] = useState<"dia" | "semana" | "mes">("dia");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    carregarServicos();
  }, []);

  const carregarServicos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('servicos')
        .select('nome, preco_normal, preco_fidelidade')
        .eq('user_id', user.id)
        .eq('ativo', true);

      if (error) throw error;
      setServicos(data || []);
    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calcularGanhos = () => {
    const agora = new Date();
    let dataInicio: Date;
    let dataFim: Date;

    switch (periodoGanhos) {
      case "dia":
        dataInicio = startOfDay(agora);
        dataFim = endOfDay(agora);
        break;
      case "semana":
        dataInicio = startOfWeek(agora, { locale: ptBR });
        dataFim = endOfWeek(agora, { locale: ptBR });
        break;
      case "mes":
        dataInicio = startOfMonth(agora);
        dataFim = endOfMonth(agora);
        break;
    }

    const agendamentosFiltrados = agendamentos.filter(ag => {
      const dataAgendamento = new Date(ag.datetime_start);
      return dataAgendamento >= dataInicio && dataAgendamento <= dataFim;
    });

    let ganhoTotal = 0;
    agendamentosFiltrados.forEach(ag => {
      const servico = servicos.find(s => s.nome.toLowerCase() === ag.servico.toLowerCase());
      if (servico) {
        const isRecorrente = ag.evento_recorrente?.toLowerCase() === 'sim';
        ganhoTotal += isRecorrente ? servico.preco_fidelidade : servico.preco_normal;
      }
    });

    return {
      total: ganhoTotal,
      quantidade: agendamentosFiltrados.length
    };
  };

  const ganhos = calcularGanhos();

  // Agrupa agendamentos por mês
  const agruparPorMes = () => {
    const meses: { [key: string]: number } = {};
    agendamentos.forEach(ag => {
      const data = new Date(ag.dia_agendado);
      const mesAno = `${data.getMonth() + 1}/${data.getFullYear()}`;
      meses[mesAno] = (meses[mesAno] || 0) + 1;
    });
    return Object.entries(meses)
      .map(([mes, total]) => ({ mes, total }))
      .sort((a, b) => {
        const [mesA, anoA] = a.mes.split('/').map(Number);
        const [mesB, anoB] = b.mes.split('/').map(Number);
        return anoA === anoB ? mesA - mesB : anoA - anoB;
      })
      .slice(-6); // Últimos 6 meses
  };

  // Agrupa serviços mais solicitados
  const servicosMaisSolicitados = () => {
    const servicos: { [key: string]: number } = {};
    agendamentos.forEach(ag => {
      servicos[ag.servico] = (servicos[ag.servico] || 0) + 1;
    });
    return Object.entries(servicos)
      .map(([servico, total]) => ({ servico, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  };

  const dadosMensais = agruparPorMes();
  const dadosServicos = servicosMaisSolicitados();

  const getPeriodoTexto = () => {
    const agora = new Date();
    switch (periodoGanhos) {
      case "dia":
        return format(agora, "dd/MM/yyyy", { locale: ptBR });
      case "semana":
        const inicioSemana = startOfWeek(agora, { locale: ptBR });
        const fimSemana = endOfWeek(agora, { locale: ptBR });
        return `${format(inicioSemana, "dd/MM", { locale: ptBR })} - ${format(fimSemana, "dd/MM/yyyy", { locale: ptBR })}`;
      case "mes":
        return format(agora, "MMMM/yyyy", { locale: ptBR });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Card de Ganhos */}
      <Card className="barber-card border-primary/20 bg-gradient-to-br from-card to-primary/5">
        <CardHeader className="border-b border-primary/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg md:text-xl font-display text-primary flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Ganhos do Período
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={periodoGanhos === "dia" ? "default" : "outline"}
                onClick={() => setPeriodoGanhos("dia")}
                className={periodoGanhos === "dia" ? "bg-primary" : "border-primary/30 hover:bg-primary/10"}
              >
                Dia
              </Button>
              <Button
                size="sm"
                variant={periodoGanhos === "semana" ? "default" : "outline"}
                onClick={() => setPeriodoGanhos("semana")}
                className={periodoGanhos === "semana" ? "bg-primary" : "border-primary/30 hover:bg-primary/10"}
              >
                Semana
              </Button>
              <Button
                size="sm"
                variant={periodoGanhos === "mes" ? "default" : "outline"}
                onClick={() => setPeriodoGanhos("mes")}
                className={periodoGanhos === "mes" ? "bg-primary" : "border-primary/30 hover:bg-primary/10"}
              >
                Mês
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">{getPeriodoTexto()}</p>
                <p className="text-4xl font-display font-bold text-primary">
                  R$ {ganhos.total.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {ganhos.quantidade} agendamento{ganhos.quantidade !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Dica:</strong> Os valores são calculados automaticamente usando o preço de fidelidade para agendamentos recorrentes e o preço normal para agendamentos avulsos.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráficos existentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      <Card className="barber-card border-primary/20 overflow-hidden">
        <CardHeader className="border-b border-primary/10 p-3 md:p-6">
          <CardTitle className="text-sm md:text-lg font-display text-primary">Agendamentos por Mês</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:pt-6 md:p-6">
          <ChartContainer
            config={{
              total: {
                label: "Agendamentos",
                color: "hsl(var(--primary))",
              },
            }}
            className="h-[200px] md:h-[300px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosMensais} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="mes" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickMargin={5}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  width={30}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  dataKey="total" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="barber-card border-primary/20 overflow-hidden">
        <CardHeader className="border-b border-primary/10 p-3 md:p-6">
          <CardTitle className="text-sm md:text-lg font-display text-primary">Serviços Mais Solicitados</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:pt-6 md:p-6">
          <ChartContainer
            config={{
              total: {
                label: "Quantidade",
                color: "hsl(var(--accent))",
              },
            }}
            className="h-[200px] md:h-[300px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosServicos} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  type="number" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                />
                <YAxis 
                  dataKey="servico" 
                  type="category" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={9}
                  width={70}
                  tickFormatter={(value) => value.length > 10 ? value.substring(0, 10) + '...' : value}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  dataKey="total" 
                  fill="hsl(var(--accent))" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
    </div>
  );
};
