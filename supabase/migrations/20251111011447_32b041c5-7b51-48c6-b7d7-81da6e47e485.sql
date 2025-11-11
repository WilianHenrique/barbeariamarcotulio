-- Adicionar user_id nas tabelas para isolamento de dados por usuário
ALTER TABLE public.agendamentos 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.mensagens_template 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Atualizar políticas RLS para agendamentos
DROP POLICY IF EXISTS "Authenticated users can view all agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Authenticated users can insert agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Authenticated users can update agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Authenticated users can delete agendamentos" ON public.agendamentos;

CREATE POLICY "Users can view their own agendamentos"
ON public.agendamentos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agendamentos"
ON public.agendamentos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agendamentos"
ON public.agendamentos FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agendamentos"
ON public.agendamentos FOR DELETE
USING (auth.uid() = user_id);

-- Atualizar políticas RLS para mensagens_template
DROP POLICY IF EXISTS "Authenticated users can view templates" ON public.mensagens_template;
DROP POLICY IF EXISTS "Authenticated users can insert templates" ON public.mensagens_template;
DROP POLICY IF EXISTS "Authenticated users can update templates" ON public.mensagens_template;
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON public.mensagens_template;

CREATE POLICY "Users can view their own templates"
ON public.mensagens_template FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates"
ON public.mensagens_template FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
ON public.mensagens_template FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
ON public.mensagens_template FOR DELETE
USING (auth.uid() = user_id);

-- Atualizar políticas RLS para historico_mensagens usando join
DROP POLICY IF EXISTS "Authenticated users can view message history" ON public.historico_mensagens;
DROP POLICY IF EXISTS "Authenticated users can insert message history" ON public.historico_mensagens;

CREATE POLICY "Users can view their own message history"
ON public.historico_mensagens FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.agendamentos 
    WHERE agendamentos.id = historico_mensagens.agendamento_id 
    AND agendamentos.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own message history"
ON public.historico_mensagens FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agendamentos 
    WHERE agendamentos.id = historico_mensagens.agendamento_id 
    AND agendamentos.user_id = auth.uid()
  )
);

-- Criar templates padrão para novos usuários via trigger
CREATE OR REPLACE FUNCTION public.create_default_templates_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.mensagens_template (user_id, tipo, mensagem, ativo) VALUES
  (NEW.id, '24h', 'Olá! Este é um lembrete de que você tem um agendamento na Barbearia Marco Túlio amanhã às {hora_agendada}. Serviço: {servico}. Nos vemos em breve!', true),
  (NEW.id, '1h', 'Olá! Seu horário na Barbearia Marco Túlio é daqui a 1 hora ({hora_agendada}). Serviço: {servico}. Estamos te esperando!', true);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_templates
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_default_templates_for_user();