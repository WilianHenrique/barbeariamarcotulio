-- Create table for system configurations
CREATE TABLE IF NOT EXISTS public.configuracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chave TEXT NOT NULL,
  valor TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, chave)
);

-- Enable RLS
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own configurations"
ON public.configuracoes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own configurations"
ON public.configuracoes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own configurations"
ON public.configuracoes
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own configurations"
ON public.configuracoes
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_configuracoes_updated_at
BEFORE UPDATE ON public.configuracoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default notification URL for existing users
INSERT INTO public.configuracoes (user_id, chave, valor)
SELECT DISTINCT user_id, 'notification_url', 'https://automacoes.federalassociadoscadastro.com/webhook/agendamentos_marco_tulio'
FROM public.agendamentos
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, chave) DO NOTHING;