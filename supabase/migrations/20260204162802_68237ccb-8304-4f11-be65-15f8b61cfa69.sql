-- Marcar agendamento como desmarcado (cliente não veio)
ALTER TABLE public.agendamentos
ADD COLUMN IF NOT EXISTS desmarcado boolean NOT NULL DEFAULT false;

-- Índice para filtros comuns (por usuário e status)
CREATE INDEX IF NOT EXISTS idx_agendamentos_user_desmarcado
ON public.agendamentos (user_id, desmarcado);
