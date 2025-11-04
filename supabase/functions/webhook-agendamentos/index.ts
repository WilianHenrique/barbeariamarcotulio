import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookData {
  id_evento: string;
  Nome_cliente: string;
  "dateTime-start": string;
  "dateTime-end": string;
  Dia_agendado_formatado: string;
  Dia_agendado: string;
  Hora_agendada: string;
  Hora_final: string;
  Link_evento: string;
  servico: string;
  tempo_total_minutos: string;
  Status_Evento: string;
  EventoRecorrente: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Webhook recebido");
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log("Dados recebidos:", body);

    // O corpo pode vir como array ou objeto único
    const agendamentos: WebhookData[] = Array.isArray(body) ? body : [body];

    for (const agendamento of agendamentos) {
      // Verificar se já existe pelo id_evento
      const { data: existente } = await supabaseClient
        .from('agendamentos')
        .select('id, id_evento')
        .eq('id_evento', agendamento.id_evento)
        .maybeSingle();

      const dadosAgendamento = {
        id_evento: agendamento.id_evento,
        nome_cliente: agendamento.Nome_cliente,
        datetime_start: agendamento["dateTime-start"],
        datetime_end: agendamento["dateTime-end"],
        dia_agendado_formatado: agendamento.Dia_agendado_formatado,
        dia_agendado: agendamento.Dia_agendado,
        hora_agendada: agendamento.Hora_agendada,
        hora_final: agendamento.Hora_final,
        link_evento: agendamento.Link_evento,
        servico: agendamento.servico,
        tempo_total_minutos: parseInt(agendamento.tempo_total_minutos),
        status_evento: agendamento.Status_Evento,
        evento_recorrente: agendamento.EventoRecorrente,
      };

      if (existente) {
        // Atualizar agendamento existente
        const { error: updateError } = await supabaseClient
          .from('agendamentos')
          .update(dadosAgendamento)
          .eq('id_evento', agendamento.id_evento);

        if (updateError) {
          console.error("Erro ao atualizar agendamento:", updateError);
          throw updateError;
        }
        console.log("Agendamento atualizado:", agendamento.id_evento);
      } else {
        // Criar novo agendamento
        const { error: insertError } = await supabaseClient
          .from('agendamentos')
          .insert([dadosAgendamento]);

        if (insertError) {
          console.error("Erro ao inserir agendamento:", insertError);
          throw insertError;
        }
        console.log("Novo agendamento criado:", agendamento.id_evento);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${agendamentos.length} agendamento(s) processado(s)` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error("Erro no webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro desconhecido" }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});