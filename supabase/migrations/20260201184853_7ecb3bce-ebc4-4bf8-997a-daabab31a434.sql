-- Tabela de vendas de produtos
CREATE TABLE IF NOT EXISTS public.vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  descricao_produto text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  nome_comprador text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilita RLS
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view their own vendas"
ON public.vendas
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vendas"
ON public.vendas
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vendas"
ON public.vendas
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vendas"
ON public.vendas
FOR DELETE
USING (auth.uid() = user_id);