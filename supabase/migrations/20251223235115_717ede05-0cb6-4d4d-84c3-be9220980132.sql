-- Create servicos table for dynamic service management
CREATE TABLE public.servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  duracao_minutos INTEGER NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;

-- Create policies for servicos
CREATE POLICY "Users can view their own servicos"
ON public.servicos
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own servicos"
ON public.servicos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own servicos"
ON public.servicos
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own servicos"
ON public.servicos
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_servicos_updated_at
BEFORE UPDATE ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default services for existing users
INSERT INTO public.servicos (user_id, nome, duracao_minutos, ordem)
SELECT DISTINCT user_id, 'Barba', 30, 1
FROM public.agendamentos
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.servicos (user_id, nome, duracao_minutos, ordem)
SELECT DISTINCT user_id, 'Cabelo', 45, 2
FROM public.agendamentos
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.servicos (user_id, nome, duracao_minutos, ordem)
SELECT DISTINCT user_id, 'Sobrancelha', 15, 3
FROM public.agendamentos
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.servicos (user_id, nome, duracao_minutos, ordem)
SELECT DISTINCT user_id, 'Barba + Cabelo', 60, 4
FROM public.agendamentos
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.servicos (user_id, nome, duracao_minutos, ordem)
SELECT DISTINCT user_id, 'Pezinho', 15, 5
FROM public.agendamentos
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.servicos (user_id, nome, duracao_minutos, ordem)
SELECT DISTINCT user_id, 'Barba + Cabelo + Sobrancelha', 75, 6
FROM public.agendamentos
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;