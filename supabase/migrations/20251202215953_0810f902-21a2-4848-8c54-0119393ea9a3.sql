-- Adicionar coluna de telefone/WhatsApp na tabela de agendamentos
ALTER TABLE public.agendamentos 
ADD COLUMN telefone_cliente TEXT;