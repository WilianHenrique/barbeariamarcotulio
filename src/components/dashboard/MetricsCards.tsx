import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, User, TrendingUp } from "lucide-react";

interface MetricsCardsProps {
  totalAgendamentos: number;
  proximas24h: number;
  realizados: number;
  totalMes: number;
}

export const MetricsCards = ({ totalAgendamentos, proximas24h, realizados, totalMes }: MetricsCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="barber-card border-primary/20 bg-gradient-to-br from-card to-primary/5 hover:shadow-glow transition-all">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Pendentes</p>
              <p className="text-3xl font-display font-bold text-primary mt-1">{totalAgendamentos}</p>
            </div>
            <div className="bg-primary/10 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="barber-card border-accent/20 bg-gradient-to-br from-card to-accent/5 hover:shadow-glow transition-all">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Próximas 24h</p>
              <p className="text-3xl font-display font-bold text-accent mt-1">{proximas24h}</p>
            </div>
            <div className="bg-accent/10 p-3 rounded-lg">
              <Clock className="h-6 w-6 text-accent" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="barber-card border-primary/20 bg-gradient-to-br from-card to-primary/5 hover:shadow-glow transition-all">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Realizados</p>
              <p className="text-3xl font-display font-bold text-primary mt-1">{realizados}</p>
            </div>
            <div className="bg-primary/10 p-3 rounded-lg">
              <User className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="barber-card border-primary/20 bg-gradient-to-br from-card to-primary/5 hover:shadow-glow transition-all">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total do Mês</p>
              <p className="text-3xl font-display font-bold text-primary mt-1">{totalMes}</p>
            </div>
            <div className="bg-primary/10 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
