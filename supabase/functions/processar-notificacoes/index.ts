import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = "https://automacoes.federalassociadoscadastro.com/webhook/agendamentos_marco_tulio";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Iniciando processamento de notificações");
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const agora = new Date();
    const em24Horas = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
    const em1Hora = new Date(agora.getTime() + 60 * 60 * 1000);

    // Buscar agendamentos que precisam de notificação de 24h
    const { data: agendamentos24h } = await supabaseClient
      .from('agendamentos')
      .select('*')
      .lte('datetime_start', em24Horas.toISOString())
      .gt('datetime_start', agora.toISOString())
      .eq('notificacao_24h_enviada', false);

    // Buscar agendamentos que precisam de notificação de 1h
    const { data: agendamentos1h } = await supabaseClient
      .from('agendamentos')
      .select('*')
      .lte('datetime_start', em1Hora.toISOString())
      .gt('datetime_start', agora.toISOString())
      .eq('notificacao_1h_enviada', false);

    let notificacoesEnviadas = 0;

    // Processar notificações de 24h
    if (agendamentos24h && agendamentos24h.length > 0) {
      console.log(`Processando ${agendamentos24h.length} notificações de 24h`);
      
      for (const agendamento of agendamentos24h) {
        try {
          const payload = {
            id_evento: agendamento.id_evento,
            Nome_cliente: agendamento.nome_cliente,
            "dateTime-start": agendamento.datetime_start,
            "dateTime-end": agendamento.datetime_end,
            Dia_agendado_formatado: agendamento.dia_agendado_formatado,
            Dia_agendado: agendamento.dia_agendado,
            Hora_agendada: agendamento.hora_agendada,
            Hora_final: agendamento.hora_final,
            Link_evento: agendamento.link_evento,
            servico: agendamento.servico,
            tempo_total_minutos: agendamento.tempo_total_minutos.toString(),
            Status_Evento: agendamento.status_evento,
            EventoRecorrente: agendamento.evento_recorrente,
            tipo_notificacao: "Notificação de 24 horas"
          };

          const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            await supabaseClient
              .from('agendamentos')
              .update({ notificacao_24h_enviada: true })
              .eq('id', agendamento.id);
            
            notificacoesEnviadas++;
            console.log(`Notificação 24h enviada para: ${agendamento.nome_cliente}`);
          }
        } catch (error) {
          console.error(`Erro ao enviar notificação 24h para ${agendamento.nome_cliente}:`, error);
        }
      }
    }

    // Processar notificações de 1h
    if (agendamentos1h && agendamentos1h.length > 0) {
      console.log(`Processando ${agendamentos1h.length} notificações de 1h`);
      
      for (const agendamento of agendamentos1h) {
        try {
          const payload = {
            id_evento: agendamento.id_evento,
            Nome_cliente: agendamento.nome_cliente,
            "dateTime-start": agendamento.datetime_start,
            "dateTime-end": agendamento.datetime_end,
            Dia_agendado_formatado: agendamento.dia_agendado_formatado,
            Dia_agendado: agendamento.dia_agendado,
            Hora_agendada: agendamento.hora_agendada,
            Hora_final: agendamento.hora_final,
            Link_evento: agendamento.link_evento,
            servico: agendamento.servico,
            tempo_total_minutos: agendamento.tempo_total_minutos.toString(),
            Status_Evento: agendamento.status_evento,
            EventoRecorrente: agendamento.evento_recorrente,
            tipo_notificacao: "Notificação de 1 hora"
          };

          const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            await supabaseClient
              .from('agendamentos')
              .update({ notificacao_1h_enviada: true })
              .eq('id', agendamento.id);
            
            notificacoesEnviadas++;
            console.log(`Notificação 1h enviada para: ${agendamento.nome_cliente}`);
          }
        } catch (error) {
          console.error(`Erro ao enviar notificação 1h para ${agendamento.nome_cliente}:`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        notificacoesEnviadas,
        message: `${notificacoesEnviadas} notificações enviadas`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error("Erro ao processar notificações:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro desconhecido" }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});