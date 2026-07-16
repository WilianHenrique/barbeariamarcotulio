import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { format, startOfDay, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface PublicAvailabilityResponse {
  ok: boolean;
  barbearia?: string;
  data?: string;
  diaAberto?: boolean;
  horariosOcupados?: string[];
  slots?: string[];
  message?: string;
}

const PublicAvailability = () => {
  const { token } = useParams();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [barbearia, setBarbearia] = useState("Barbearia");
  const [diaAberto, setDiaAberto] = useState(true);
  const [horariosOcupados, setHorariosOcupados] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]);

  const carregarDisponibilidade = async (date: Date) => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke<PublicAvailabilityResponse>(
        "public-availability",
        {
          body: {
            token,
            date: startOfDay(date).toISOString(),
          },
        }
      );

      if (fnError || !data?.ok) {
        throw new Error(data?.message || "Não foi possível carregar os horários.");
      }

      setBarbearia(data.barbearia || "Barbearia");
      setDiaAberto(Boolean(data.diaAberto));
      setHorariosOcupados(data.horariosOcupados || []);
      setSlots(data.slots || []);
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar disponibilidade");
      setHorariosOcupados([]);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDisponibilidade(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedDate]);

  const horariosDisponiveis = useMemo(
    () => slots.filter((slot) => !horariosOcupados.includes(slot)),
    [slots, horariosOcupados]
  );

  const periodoLabel = useMemo(() => {
    if (!slots.length) return "";
    return `${slots[0]} às ${slots[slots.length - 1]}`;
  }, [slots]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="barber-card border-primary/30 shadow-glow">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-2xl sm:text-3xl font-display text-primary">
                  Horários do dia
                </CardTitle>
                <CardDescription className="text-muted-foreground text-base mt-1">
                  {barbearia} · consulte horários reservados e disponíveis
                </CardDescription>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal min-w-[220px]">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(selectedDate, "EEEE, dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {periodoLabel && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                Janela de atendimento: {periodoLabel}
              </div>
            )}
          </CardHeader>
        </Card>

        <Card className="barber-card border-primary/20">
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-16 text-muted-foreground">Carregando horários...</div>
            ) : error ? (
              <div className="text-center py-16 text-destructive">{error}</div>
            ) : !diaAberto ? (
              <div className="text-center py-16 space-y-2">
                <Badge variant="secondary" className="text-sm">Fechado neste dia</Badge>
                <p className="text-muted-foreground">A barbearia não atende nesta data.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-3 text-sm">
                  <Badge variant="secondary" className="px-3 py-1">Reservados: {horariosOcupados.length}</Badge>
                  <Badge variant="outline" className="px-3 py-1">Disponíveis: {horariosDisponiveis.length}</Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {slots.map((slot) => {
                    const ocupado = horariosOcupados.includes(slot);
                    return (
                      <div
                        key={slot}
                        className={cn(
                          "border rounded-md px-3 py-2 text-sm text-center font-medium",
                          ocupado
                            ? "bg-muted text-muted-foreground border-border line-through"
                            : "bg-primary/10 text-primary border-primary/30"
                        )}
                      >
                        {slot}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicAvailability;
