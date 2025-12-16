import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface Agendamento {
  dia_agendado: string;
  servico: string;
}

interface RelatorioGeralProps {
  agendamentos: Agendamento[];
}

export const RelatorioGeral = ({ agendamentos }: RelatorioGeralProps) => {
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

  return (
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
  );
};
