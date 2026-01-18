import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_WEBHOOK_URL = "https://automacoes.federalassociadoscadastro.com/webhook/agendamentos_marco_tulio";

const getFirstName = (fullName: string | null | undefined) => {
  const cleaned = (fullName ?? '').trim();
  if (!cleaned) return '';
  return cleaned.split(/\s+/)[0];
};

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
      .or('notificacao_24h_enviada.is.null,notificacao_24h_enviada.eq.false');

    if (error24h) {
      console.error("Erro ao buscar agendamentos 24h:", error24h);
    }

    // Buscar agendamentos que precisam de notificação de 1h
    const { data: agendamentos1h, error: error1h } = await supabaseClient
      .from('agendamentos')
      .select('*')
      .gte('datetime_start', inicio1h.toISOString())
      .lte('datetime_start', fim1h.toISOString())
      .or('notificacao_1h_enviada.is.null,notificacao_1h_enviada.eq.false');

    if (error1h) {
      console.error("Erro ao buscar agendamentos 1h:", error1h);
    }

    // Buscar agendamentos para lembrete de pagamento
    const { data: agendamentosPagamento, error: errorPagamento } = await supabaseClient
      .from('agendamentos')
      .select('*')
      .eq('pagamento_pendente', true)
      .eq('lembrete_pagamento_enviado', false)
      .eq('enviar_notificacao_cobranca', true)
      .lt('datetime_start', agora.toISOString());

    if (errorPagamento) {
      console.error("Erro ao buscar agendamentos de pagamento:", errorPagamento);
    }

    let notificacoesEnviadas = 0;

    // Processar notificações de 24h
    if (agendamentos24h && agendamentos24h.length > 0) {
      console.log(`Processando ${agendamentos24h.length} notificações de 24h`);
      
      for (const agendamento of agendamentos24h) {
        try {
          // Normalizar telefone para apenas números (WhatsApp)
          const telefoneWhatsApp = agendamento.telefone_cliente
            ? agendamento.telefone_cliente.replace(/\D/g, '')
            : '';

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
          const firstName = getFirstName(agendamento.nome_cliente) || agendamento.nome_cliente;

          let mensagemPersonalizada = template24h.mensagem;
          mensagemPersonalizada = mensagemPersonalizada
            .replace(/{hora_agendada}/g, agendamento.hora_agendada)
            .replace(/{servico}/g, agendamento.servico)
            .replace(/{nome_cliente}/g, firstName);

          // Formatar dia agendado no padrão brasileiro DD/MM/AAAA
          const dataEvento24h = new Date(agendamento.datetime_start);
          const diaAgendadoBR24h = `${String(dataEvento24h.getDate()).padStart(2, '0')}/${String(dataEvento24h.getMonth() + 1).padStart(2, '0')}/${dataEvento24h.getFullYear()}`;

          // Calcular quanto tempo falta para o evento acontecer
          const diffMs24h = dataEvento24h.getTime() - agora.getTime();
          const diffMinTotal24h = Math.max(0, Math.round(diffMs24h / (1000 * 60)));
          let tempo_evento_24h = '';

          if (diffMinTotal24h >= 60) {
            const horas = Math.floor(diffMinTotal24h / 60);
            tempo_evento_24h = horas === 1 ? '1 hora' : `${horas} horas`;
          } else {
            tempo_evento_24h = `${diffMinTotal24h} minutos`;
          }

          const payload = {
            id_evento: agendamento.id_evento,
            Nome_cliente: firstName,
            "dateTime-start": agendamento.datetime_start,
            "dateTime-end": agendamento.datetime_end,
            Dia_agendado_formatado: agendamento.dia_agendado_formatado,
            Dia_agendado: diaAgendadoBR24h,
            Hora_agendada: agendamento.hora_agendada,
            Hora_final: agendamento.hora_final,
            Link_evento: agendamento.link_evento,
            servico: agendamento.servico,
            tempo_total_minutos: agendamento.tempo_total_minutos.toString(),
            tempo_evento: tempo_evento_24h,
            Status_Evento: agendamento.status_evento,
            EventoRecorrente: agendamento.evento_recorrente,
            telefone_whatsapp: telefoneWhatsApp,
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
          // Normalizar telefone para apenas números (WhatsApp)
          const telefoneWhatsApp = agendamento.telefone_cliente
            ? agendamento.telefone_cliente.replace(/\D/g, '')
            : '';

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
          const firstName = getFirstName(agendamento.nome_cliente) || agendamento.nome_cliente;

          let mensagemPersonalizada = template1h.mensagem;
          mensagemPersonalizada = mensagemPersonalizada
            .replace(/{hora_agendada}/g, agendamento.hora_agendada)
            .replace(/{servico}/g, agendamento.servico)
            .replace(/{nome_cliente}/g, firstName);

          // Formatar dia agendado no padrão brasileiro DD/MM/AAAA
          const dataEvento1h = new Date(agendamento.datetime_start);
          const diaAgendadoBR1h = `${String(dataEvento1h.getDate()).padStart(2, '0')}/${String(dataEvento1h.getMonth() + 1).padStart(2, '0')}/${dataEvento1h.getFullYear()}`;

          // Calcular quanto tempo falta para o evento acontecer
          const diffMs1h = dataEvento1h.getTime() - agora.getTime();
          const diffMinTotal1h = Math.max(0, Math.round(diffMs1h / (1000 * 60)));
          let tempo_evento_1h = '';

          if (diffMinTotal1h >= 60) {
            const horas = Math.floor(diffMinTotal1h / 60);
            tempo_evento_1h = horas === 1 ? '1 hora' : `${horas} horas`;
          } else {
            tempo_evento_1h = `${diffMinTotal1h} minutos`;
          }

          const payload = {
            id_evento: agendamento.id_evento,
            Nome_cliente: firstName,
            "dateTime-start": agendamento.datetime_start,
            "dateTime-end": agendamento.datetime_end,
            Dia_agendado_formatado: agendamento.dia_agendado_formatado,
            Dia_agendado: diaAgendadoBR1h,
            Hora_agendada: agendamento.hora_agendada,
            Hora_final: agendamento.hora_final,
            Link_evento: agendamento.link_evento,
            servico: agendamento.servico,
            tempo_total_minutos: agendamento.tempo_total_minutos.toString(),
            tempo_evento: tempo_evento_1h,
            Status_Evento: agendamento.status_evento,
            EventoRecorrente: agendamento.evento_recorrente,
            telefone_whatsapp: telefoneWhatsApp,
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

    // Processar lembretes de pagamento
    if (agendamentosPagamento && agendamentosPagamento.length > 0) {
      console.log(`Processando ${agendamentosPagamento.length} lembretes de pagamento`);
      
      for (const agendamento of agendamentosPagamento) {
        try {
          // Buscar configuração de horas do usuário
          const { data: configHoras } = await supabaseClient
            .from('configuracoes')
            .select('valor')
            .eq('user_id', agendamento.user_id)
            .eq('chave', 'horas_lembrete_pagamento')
            .maybeSingle();

          const horasLembrete = parseInt(configHoras?.valor || '24');
          
          // Calcular se já passou o tempo configurado após o agendamento
          const dataAgendamento = new Date(agendamento.datetime_start);
          const horasPassadas = (agora.getTime() - dataAgendamento.getTime()) / (1000 * 60 * 60);
          
          if (horasPassadas < horasLembrete) {
            console.log(`Ainda não passou o tempo necessário para enviar lembrete de pagamento para ${agendamento.nome_cliente}`);
            continue;
          }

          // Normalizar telefone para apenas números (WhatsApp)
          const telefoneWhatsApp = agendamento.telefone_cliente
            ? agendamento.telefone_cliente.replace(/\D/g, '')
            : '';

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
            .eq('tipo', 'lembrete_pagamento')
            .eq('ativo', true)
            .order('created_at', { ascending: false })
            .limit(1);

          const templatePagamento = templates?.[0];

          if (!templatePagamento) {
            console.log(`Template de pagamento não encontrado ou inativo para usuário ${agendamento.user_id}`);
            continue;
          }

          // Substituir variáveis na mensagem personalizada
          const firstName = getFirstName(agendamento.nome_cliente) || agendamento.nome_cliente;

          let mensagemPersonalizada = templatePagamento.mensagem;
          const valorServico = agendamento.valor_servico 
            ? `R$ ${agendamento.valor_servico.toFixed(2)}`
            : 'não informado';
          
          mensagemPersonalizada = mensagemPersonalizada
            .replace(/{hora_agendada}/g, agendamento.hora_agendada)
            .replace(/{servico}/g, agendamento.servico)
            .replace(/{nome_cliente}/g, firstName)
            .replace(/{valor_servico}/g, valorServico);

          // Formatar dia agendado no padrão brasileiro DD/MM/AAAA
          const dataEventoPagamento = new Date(agendamento.datetime_start);
          const diaAgendadoBRPagamento = `${String(dataEventoPagamento.getDate()).padStart(2, '0')}/${String(dataEventoPagamento.getMonth() + 1).padStart(2, '0')}/${dataEventoPagamento.getFullYear()}`;

          const payload = {
            id_evento: agendamento.id_evento,
            Nome_cliente: firstName,
            "dateTime-start": agendamento.datetime_start,
            "dateTime-end": agendamento.datetime_end,
            Dia_agendado_formatado: agendamento.dia_agendado_formatado,
            Dia_agendado: diaAgendadoBRPagamento,
            Hora_agendada: agendamento.hora_agendada,
            Hora_final: agendamento.hora_final,
            Link_evento: agendamento.link_evento,
            servico: agendamento.servico,
            tempo_total_minutos: agendamento.tempo_total_minutos.toString(),
            Status_Evento: agendamento.status_evento,
            EventoRecorrente: agendamento.evento_recorrente,
            telefone_whatsapp: telefoneWhatsApp,
            tipo_notificacao: "Lembrete de Pagamento",
            mensagem_personalizada: mensagemPersonalizada,
            valor_servico: valorServico
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
              .update({ lembrete_pagamento_enviado: true })
              .eq('id', agendamento.id);
            
            // Registrar no histórico
            await supabaseClient
              .from('historico_mensagens')
              .insert({
                agendamento_id: agendamento.id,
                nome_cliente: agendamento.nome_cliente,
                tipo_notificacao: "Lembrete de Pagamento",
                mensagem_enviada: mensagemPersonalizada,
                status: 'enviada'
              });
            
            notificacoesEnviadas++;
            console.log(`Lembrete de pagamento enviado para: ${agendamento.nome_cliente}`);
          }
        } catch (error) {
          console.error(`Erro ao enviar lembrete de pagamento para ${agendamento.nome_cliente}:`, error);
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