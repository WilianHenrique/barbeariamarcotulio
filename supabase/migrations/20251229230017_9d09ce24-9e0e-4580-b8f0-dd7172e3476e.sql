-- Add payment-related fields to agendamentos
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS pagamento_pendente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lembrete_pagamento_enviado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_servico numeric(10,2) NULL;

-- No changes needed for mensagens_template (supports generic tipos)
-- Config key for payment reminder delay will be stored in configuracoes with chave 'horas_lembrete_pagamento'