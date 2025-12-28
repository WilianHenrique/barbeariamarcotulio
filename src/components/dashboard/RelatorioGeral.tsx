import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, isSameDay, isSameWeek, isSameMonth } from "date-fns";
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
  const [periodoGrafico, setPeriodoGrafico] = useState<"dia" | "semana" | "mes">("dia");
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

  // Calcula faturamento por período (dia/semana/mês)
  const calcularFaturamentoPorPeriodo = () => {
    const agora = new Date();
    const agendamentosPassados = agendamentos.filter(ag => new Date(ag.datetime_start) < agora);
    
    let dataInicio: Date;
    let dataFim: Date;

    switch (periodoGrafico) {
      case "dia":
        dataInicio = startOfMonth(agora);
        dataFim = endOfDay(agora);
        break;
      case "semana":
        dataInicio = startOfMonth(agora);
        dataFim = endOfWeek(agora, { locale: ptBR });
        break;
      case "mes":
        dataInicio = startOfMonth(new Date(agora.getFullYear(), 0, 1));
        dataFim = endOfMonth(agora);
        break;
    }

    let periodos: Date[] = [];
    
    if (periodoGrafico === "dia") {
      periodos = eachDayOfInterval({ start: dataInicio, end: dataFim });
    } else if (periodoGrafico === "semana") {
      periodos = eachWeekOfInterval({ start: dataInicio, end: dataFim }, { locale: ptBR });
    } else {
      periodos = eachMonthOfInterval({ start: dataInicio, end: dataFim });
    }

    return periodos.map(periodo => {
      const agendamentosDoPeriodo = agendamentosPassados.filter(ag => {
        const dataAgendamento = new Date(ag.datetime_start);
        
        if (periodoGrafico === "dia") {
          return isSameDay(dataAgendamento, periodo);
        } else if (periodoGrafico === "semana") {
          return isSameWeek(dataAgendamento, periodo, { locale: ptBR });
        } else {
          return isSameMonth(dataAgendamento, periodo);
        }
      });

      let faturamento = 0;
      agendamentosDoPeriodo.forEach(ag => {
        const servico = servicos.find(s => s.nome.toLowerCase() === ag.servico.toLowerCase());
        if (servico) {
          const isRecorrente = ag.evento_recorrente?.toLowerCase() === 'sim';
          faturamento += isRecorrente ? servico.preco_fidelidade : servico.preco_normal;
        }
      });

      let label = "";
      if (periodoGrafico === "dia") {
        label = format(periodo, "dd/MM", { locale: ptBR });
      } else if (periodoGrafico === "semana") {
        label = `Sem ${format(periodo, "w", { locale: ptBR })}`;
      } else {
        label = format(periodo, "MMM", { locale: ptBR });
      }

      return {
        periodo: label,
        faturamento: Number(faturamento.toFixed(2))
      };
    }).filter(item => item.faturamento > 0 || periodoGrafico === "dia"); // Mostra todos os dias, mas só semanas/meses com faturamento
  };

  const dadosMensais = agruparPorMes();
  const dadosServicos = servicosMaisSolicitados();
  const dadosFaturamento = calcularFaturamentoPorPeriodo();
  const faturamentoTotal = dadosFaturamento.reduce((sum, item) => sum + item.faturamento, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Gráfico de Faturamento */}
      <Card className="barber-card border-primary/20 bg-gradient-to-br from-card to-accent/5">
        <CardHeader className="border-b border-primary/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg md:text-xl font-display text-primary flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolução do Faturamento
            </CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={periodoGrafico === "dia" ? "default" : "outline"}
                onClick={() => setPeriodoGrafico("dia")}
                className={periodoGrafico === "dia" ? "bg-primary" : "border-primary/30 hover:bg-primary/10"}
              >
                Dia
              </Button>
              <Button
                size="sm"
                variant={periodoGrafico === "semana" ? "default" : "outline"}
                onClick={() => setPeriodoGrafico("semana")}
                className={periodoGrafico === "semana" ? "bg-primary" : "border-primary/30 hover:bg-primary/10"}
              >
                Semana
              </Button>
              <Button
                size="sm"
                variant={periodoGrafico === "mes" ? "default" : "outline"}
                onClick={() => setPeriodoGrafico("mes")}
                className={periodoGrafico === "mes" ? "bg-primary" : "border-primary/30 hover:bg-primary/10"}
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
              <div className="text-center pb-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Faturamento Total ({periodoGrafico === "dia" ? "Mês Atual" : periodoGrafico === "semana" ? "Mês Atual" : "Ano Atual"})
                </p>
                <p className="text-4xl font-display font-bold text-primary">
                  R$ {faturamentoTotal.toFixed(2)}
                </p>
              </div>
              
              <ChartContainer
                config={{
                  faturamento: {
                    label: "Faturamento",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[300px] md:h-[350px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosFaturamento} margin={{ top: 30, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="periodo" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickMargin={8}
                      angle={periodoGrafico === "dia" ? -45 : 0}
                      textAnchor={periodoGrafico === "dia" ? "end" : "middle"}
                      height={periodoGrafico === "dia" ? 60 : 40}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      width={50}
                      tickFormatter={(value) => `R$${value}`}
                    />
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border border-primary/20 rounded-lg p-3 shadow-lg">
                              <p className="text-sm font-medium text-foreground">{payload[0].payload.periodo}</p>
                              <p className="text-lg font-bold text-primary">
                                R$ {Number(payload[0].value).toFixed(2)}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="faturamento" 
                      fill="hsl(var(--primary))" 
                      radius={[8, 8, 0, 0]}
                      maxBarSize={60}
                    >
                      <LabelList 
                        dataKey="faturamento" 
                        position="top" 
                        formatter={(value: number) => value > 0 ? `R$ ${value.toFixed(0)}` : ''}
                        style={{ 
                          fill: 'hsl(var(--foreground))',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
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
