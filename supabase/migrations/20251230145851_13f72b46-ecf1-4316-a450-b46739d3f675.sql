-- Adiciona coluna para controlar se notificação de cobrança deve ser enviada
ALTER TABLE agendamentos 
ADD COLUMN enviar_notificacao_cobranca boolean DEFAULT false;