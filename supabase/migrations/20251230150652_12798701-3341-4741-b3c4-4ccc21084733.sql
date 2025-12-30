-- Remover a constraint antiga que limitava os tipos
ALTER TABLE mensagens_template DROP CONSTRAINT IF EXISTS mensagens_template_tipo_check;

-- Adicionar nova constraint que inclui o tipo lembrete_pagamento
ALTER TABLE mensagens_template ADD CONSTRAINT mensagens_template_tipo_check 
CHECK (tipo IN ('24h', '1h', 'lembrete_pagamento'));