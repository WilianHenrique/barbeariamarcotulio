import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_WEBHOOK_URL = "https://automacoes.federalassociadoscadastro.com/webhook/agendamentos_marco_tulio";

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
    
    // Calcular janelas de tempo (de agora até 24h15min e até 1h15min no futuro)
    // Adicionamos 15 minutos de margem para garantir que não perdemos notificações
    const inicio24h = new Date(agora.getTime() + 23 * 60 * 60 * 1000 + 45 * 60 * 1000); // 23h45min
    const fim24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000 + 15 * 60 * 1000); // 24h15min
    
    const inicio1h = new Date(agora.getTime() + 45 * 60 * 1000); // 45min
    const fim1h = new Date(agora.getTime() + 1 * 60 * 60 * 1000 + 15 * 60 * 1000); // 1h15min

    console.log(`Buscando notificações 24h entre ${inicio24h.toISOString()} e ${fim24h.toISOString()}`);
    console.log(`Buscando notificações 1h entre ${inicio1h.toISOString()} e ${fim1h.toISOString()}`);

    // Buscar agendamentos que precisam de notificação de 24h
    const { data: agendamentos24h, error: error24h } = await supabaseClient
      .from('agendamentos')
      .select('*')
      .gte('datetime_start', inicio24h.toISOString())
      .lte('datetime_start', fim24h.toISOString())
      .eq('notificacao_24h_enviada', false);

    if (error24h) {
      console.error("Erro ao buscar agendamentos 24h:", error24h);
    }

    // Buscar agendamentos que precisam de notificação de 1h
    const { data: agendamentos1h, error: error1h } = await supabaseClient
      .from('agendamentos')
      .select('*')
      .gte('datetime_start', inicio1h.toISOString())
      .lte('datetime_start', fim1h.toISOString())
      .eq('notificacao_1h_enviada', false);

    if (error1h) {
      console.error("Erro ao buscar agendamentos 1h:", error1h);
    }

    let notificacoesEnviadas = 0;

    // Processar notificações de 24h
    if (agendamentos24h && agendamentos24h.length > 0) {
      console.log(`Processando ${agendamentos24h.length} notificações de 24h`);
      
      for (const agendamento of agendamentos24h) {
        try {
          // Buscar URL de notificação do usuário
          const { data: config } = await supabaseClient
            .from('configuracoes')
            .select('valor')
            .eq('user_id', agendamento.user_id)
            .eq('chave', 'notification_url')
            .maybeSingle();

          const webhookUrl = config?.valor || DEFAULT_WEBHOOK_URL;
          console.log(`Usando webhook URL: ${webhookUrl} para usuário ${agendamento.user_id}`);

          // Buscar template do usuário
          const { data: templates } = await supabaseClient
            .from('mensagens_template')
            .select('*')
            .eq('user_id', agendamento.user_id)
            .eq('tipo', '24h')
            .eq('ativo', true)
            .order('created_at', { ascending: false })
            .limit(1);

          const template24h = templates?.[0];

          if (!template24h) {
            console.log(`Template 24h não encontrado ou inativo para usuário ${agendamento.user_id}`);
            continue;
          }

          // Substituir variáveis na mensagem personalizada
          let mensagemPersonalizada = template24h.mensagem;
          mensagemPersonalizada = mensagemPersonalizada
            .replace(/{hora_agendada}/g, agendamento.hora_agendada)
            .replace(/{servico}/g, agendamento.servico)
            .replace(/{nome_cliente}/g, agendamento.nome_cliente);

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
            tipo_notificacao: "Notificação de 24 horas",
            mensagem_personalizada: mensagemPersonalizada
          };

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            // Atualizar flag no agendamento
            await supabaseClient
              .from('agendamentos')
              .update({ notificacao_24h_enviada: true })
              .eq('id', agendamento.id);
            
            // Registrar no histórico
            await supabaseClient
              .from('historico_mensagens')
              .insert({
                agendamento_id: agendamento.id,
                nome_cliente: agendamento.nome_cliente,
                tipo_notificacao: "Notificação de 24 horas",
                mensagem_enviada: mensagemPersonalizada,
                status: 'enviada'
              });
            
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
          // Buscar URL de notificação do usuário
          const { data: config } = await supabaseClient
            .from('configuracoes')
            .select('valor')
            .eq('user_id', agendamento.user_id)
            .eq('chave', 'notification_url')
            .maybeSingle();

          const webhookUrl = config?.valor || DEFAULT_WEBHOOK_URL;
          console.log(`Usando webhook URL: ${webhookUrl} para usuário ${agendamento.user_id}`);

          // Buscar template do usuário
          const { data: templates } = await supabaseClient
            .from('mensagens_template')
            .select('*')
            .eq('user_id', agendamento.user_id)
            .eq('tipo', '1h')
            .eq('ativo', true)
            .order('created_at', { ascending: false })
            .limit(1);

          const template1h = templates?.[0];

          if (!template1h) {
            console.log(`Template 1h não encontrado ou inativo para usuário ${agendamento.user_id}`);
            continue;
          }

          // Substituir variáveis na mensagem personalizada
          let mensagemPersonalizada = template1h.mensagem;
          mensagemPersonalizada = mensagemPersonalizada
            .replace(/{hora_agendada}/g, agendamento.hora_agendada)
            .replace(/{servico}/g, agendamento.servico)
            .replace(/{nome_cliente}/g, agendamento.nome_cliente);

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
            tipo_notificacao: "Notificação de 1 hora",
            mensagem_personalizada: mensagemPersonalizada
          };

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            // Atualizar flag no agendamento
            await supabaseClient
              .from('agendamentos')
              .update({ notificacao_1h_enviada: true })
              .eq('id', agendamento.id);
            
            // Registrar no histórico
            await supabaseClient
              .from('historico_mensagens')
              .insert({
                agendamento_id: agendamento.id,
                nome_cliente: agendamento.nome_cliente,
                tipo_notificacao: "Notificação de 1 hora",
                mensagem_enviada: mensagemPersonalizada,
                status: 'enviada'
              });
            
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