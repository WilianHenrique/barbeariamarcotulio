-- Tabela para armazenar templates de mensagens personalizadas
CREATE TABLE public.mensagens_template (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('24h', '1h')),
  mensagem TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mensagens_template ENABLE ROW LEVEL SECURITY;

-- Policies para mensagens_template
CREATE POLICY "Authenticated users can view templates"
ON public.mensagens_template FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert templates"
ON public.mensagens_template FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update templates"
ON public.mensagens_template FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete templates"
ON public.mensagens_template FOR DELETE
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_mensagens_template_updated_at
BEFORE UPDATE ON public.mensagens_template
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para histórico de mensagens enviadas
CREATE TABLE public.historico_mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  nome_cliente TEXT NOT NULL,
  tipo_notificacao TEXT NOT NULL,
  mensagem_enviada TEXT NOT NULL,
  enviado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'enviada'
);

-- Enable RLS
ALTER TABLE public.historico_mensagens ENABLE ROW LEVEL SECURITY;

-- Policies para historico_mensagens
CREATE POLICY "Authenticated users can view message history"
ON public.historico_mensagens FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert message history"
ON public.historico_mensagens FOR INSERT
WITH CHECK (true);

-- Inserir templates padrão
INSERT INTO public.mensagens_template (tipo, mensagem, ativo) VALUES
('24h', 'Olá! Este é um lembrete de que você tem um agendamento na Barbearia Marco Túlio amanhã às {hora_agendada}. Serviço: {servico}. Nos vemos em breve!', true),
('1h', 'Olá! Seu horário na Barbearia Marco Túlio é daqui a 1 hora ({hora_agendada}). Serviço: {servico}. Estamos te esperando!', true);