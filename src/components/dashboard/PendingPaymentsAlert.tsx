import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle } from "lucide-react";

type PendingPaymentItem = {
  id: string;
  datetime_start: string;
  servico: string;
  valor_servico: number | null;
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildNameIlikePattern(nome: string) {
  // Troca espaços por % para tolerar variações (ex.: duplo espaço no banco)
  const parts = nome
    .trim()
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  return `%${parts.join("%")}%`;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

type PendingPaymentsAlertProps = {
  /** Mostre SOMENTE quando o cliente foi selecionado (não enquanto digita). */
  enabled: boolean;
  nomeCliente: string;
  telefoneCliente?: string | null;
};

export function PendingPaymentsAlert({ enabled, nomeCliente, telefoneCliente }: PendingPaymentsAlertProps) {
  const nome = useMemo(() => normalizeName(nomeCliente), [nomeCliente]);
  const telefone = useMemo(
    () => (telefoneCliente ? onlyDigits(telefoneCliente) : ""),
    [telefoneCliente],
  );
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PendingPaymentItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!enabled) {
        setLoading(false);
        setItems([]);
        return;
      }

      if (telefone.length < 10 && nome.length < 2) {
        setItems([]);
        return;
      }

      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const nowIso = new Date().toISOString();
        let query = supabase
          .from("agendamentos")
          .select("id, datetime_start, servico, valor_servico")
          .eq("user_id", user.id)
          .eq("pagamento_pendente", true)
          .lt("datetime_start", nowIso)
          .order("datetime_start", { ascending: false });

        // Preferir telefone (identificador mais estável). Fallback para nome.
        if (telefone.length >= 10) {
          query = query.eq("telefone_cliente", telefone);
        } else {
          // tolerante a variações de espaçamento/case
          query = query.ilike("nome_cliente", buildNameIlikePattern(nome));
        }

        const { data, error } = await query;

        if (error) throw error;
        if (!cancelled) setItems((data as PendingPaymentItem[]) || []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const t = setTimeout(run, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [enabled, nome, telefone]);

  const total = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.valor_servico ?? 0) || 0), 0),
    [items],
  );

  if (!enabled) return null;
  if (!loading && items.length === 0) return null;

  return (
    <Alert variant="destructive" className="bg-destructive/5 text-foreground">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Cliente com pagamentos pendentes</AlertTitle>
      <AlertDescription>
        {loading ? (
          <p className="text-muted-foreground">Verificando pendências…</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">
              Total em aberto: <span className="font-semibold">R$ {total.toFixed(2)}</span>
            </p>
            <ul className="text-sm space-y-1">
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {format(parseISO(it.datetime_start), "dd/MM/yyyy", { locale: ptBR })} • {it.servico}
                  </span>
                  <span className="font-medium">R$ {(Number(it.valor_servico ?? 0) || 0).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
