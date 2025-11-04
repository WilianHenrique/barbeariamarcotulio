-- Criar tabela de agendamentos
CREATE TABLE public.agendamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_evento text NOT NULL UNIQUE,
  nome_cliente text NOT NULL,
  datetime_start timestamptz NOT NULL,
  datetime_end timestamptz NOT NULL,
  dia_agendado_formatado text NOT NULL,
  dia_agendado date NOT NULL,
  hora_agendada text NOT NULL,
  hora_final text NOT NULL,
  link_evento text NOT NULL,
  servico text NOT NULL,
  tempo_total_minutos integer NOT NULL,
  status_evento text NOT NULL,
  evento_recorrente text NOT NULL,
  notificacao_24h_enviada boolean DEFAULT false,
  notificacao_1h_enviada boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para usuários autenticados verem todos os agendamentos
CREATE POLICY "Authenticated users can view all agendamentos"
ON public.agendamentos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert agendamentos"
ON public.agendamentos
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update agendamentos"
ON public.agendamentos
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete agendamentos"
ON public.agendamentos
FOR DELETE
TO authenticated
USING (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_agendamentos_updated_at
BEFORE UPDATE ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_agendamentos_datetime_start ON public.agendamentos(datetime_start);
CREATE INDEX idx_agendamentos_id_evento ON public.agendamentos(id_evento);
CREATE INDEX idx_agendamentos_notificacoes ON public.agendamentos(notificacao_24h_enviada, notificacao_1h_enviada);