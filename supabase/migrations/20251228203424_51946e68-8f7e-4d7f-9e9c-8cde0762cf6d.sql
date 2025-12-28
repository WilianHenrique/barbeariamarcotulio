-- Adicionar colunas de preço aos serviços
ALTER TABLE public.servicos
ADD COLUMN preco_normal DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
ADD COLUMN preco_fidelidade DECIMAL(10,2) DEFAULT 0.00 NOT NULL;