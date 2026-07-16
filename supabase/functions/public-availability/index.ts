import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_DIAS_ABERTOS = [2, 3, 4, 5, 6];
const HORA_INICIO = 7;
const HORA_FIM = 20;
const INTERVALO_MINUTOS = 30;

const gerarSlots = () => {
  const slots: string[] = [];
  const inicio = new Date();
  inicio.setHours(HORA_INICIO, 0, 0, 0);
  const fim = new Date();
  fim.setHours(HORA_FIM, 0, 0, 0);

  const cursor = new Date(inicio);
  while (cursor <= fim) {
    const hh = String(cursor.getHours()).padStart(2, "0");
    const mm = String(cursor.getMinutes()).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
    cursor.setMinutes(cursor.getMinutes() + INTERVALO_MINUTOS);
  }

  return slots;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, date } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ ok: false, message: "Token inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const dateEnd = new Date(targetDate);
    dateEnd.setDate(dateEnd.getDate() + 1);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: tokenConfig, error: tokenError } = await supabase
      .from("configuracoes")
      .select("user_id")
      .eq("chave", "public_availability_token")
      .eq("valor", token)
      .maybeSingle();

    if (tokenError || !tokenConfig?.user_id) {
      return new Response(JSON.stringify({ ok: false, message: "Link público inválido." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = tokenConfig.user_id;

    const { data: diasConfig } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("user_id", userId)
      .eq("chave", "dias_funcionamento")
      .maybeSingle();

    let diasAbertos = DEFAULT_DIAS_ABERTOS;
    if (diasConfig?.valor) {
      try {
        const parsed = JSON.parse(diasConfig.valor);
        if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
          diasAbertos = parsed;
        }
      } catch {
        // usa padrão
      }
    }

    const diaSemana = targetDate.getDay();
    const diaAberto = diasAbertos.includes(diaSemana);
    const slots = gerarSlots();

    if (!diaAberto) {
      return new Response(
        JSON.stringify({
          ok: true,
          barbearia: "Barbearia Marco Túlio",
          data: targetDate.toISOString(),
          diaAberto: false,
          horariosOcupados: [],
          slots,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: agendamentos, error: agError } = await supabase
      .from("agendamentos")
      .select("hora_agendada, datetime_start, desmarcado")
      .eq("user_id", userId)
      .gte("datetime_start", targetDate.toISOString())
      .lt("datetime_start", dateEnd.toISOString())
      .order("datetime_start", { ascending: true });

    if (agError) {
      throw agError;
    }

    const horariosOcupados = Array.from(
      new Set(
        (agendamentos || [])
          .filter((ag: any) => !ag.desmarcado)
          .map((ag: any) => {
            if (ag.hora_agendada && typeof ag.hora_agendada === "string") {
              return ag.hora_agendada.slice(0, 5);
            }
            const dt = new Date(ag.datetime_start);
            return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
          })
      )
    );

    return new Response(
      JSON.stringify({
        ok: true,
        barbearia: "Barbearia Marco Túlio",
        data: targetDate.toISOString(),
        diaAberto: true,
        horariosOcupados,
        slots,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro no public-availability:", error);
    return new Response(JSON.stringify({ ok: false, message: "Erro ao carregar disponibilidade." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
