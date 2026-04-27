-- Adiciona suporte a senha para clientes do salão
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS password_set_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_clients_email_lower ON public.clients (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_global_email_lower ON public.clients (lower(global_identity_email)) WHERE global_identity_email IS NOT NULL;

-- Tabela de tokens para redefinição de senha (single-use, com expiração)
CREATE TABLE IF NOT EXISTS public.client_password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_password_reset_tokens_email ON public.client_password_reset_tokens (lower(email));
CREATE INDEX IF NOT EXISTS idx_client_password_reset_tokens_expires ON public.client_password_reset_tokens (expires_at) WHERE used_at IS NULL;

ALTER TABLE public.client_password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Sem políticas para clientes anônimos: tudo é manipulado por edge functions usando service_role
-- Super admins podem inspecionar (auditoria)
CREATE POLICY "Super admins can view password reset tokens"
  ON public.client_password_reset_tokens FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));