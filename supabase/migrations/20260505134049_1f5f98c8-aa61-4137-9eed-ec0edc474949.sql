
-- user_session_logs table
CREATE TABLE IF NOT EXISTS public.user_session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_route TEXT NOT NULL,
  page_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  session_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  referrer_page TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usl_establishment ON public.user_session_logs(establishment_id);
CREATE INDEX IF NOT EXISTS idx_usl_session_start ON public.user_session_logs(session_start DESC);
CREATE INDEX IF NOT EXISTS idx_usl_user ON public.user_session_logs(user_id);

ALTER TABLE public.user_session_logs ENABLE ROW LEVEL SECURITY;

-- Only super_admin can read logs
CREATE POLICY "Super admin reads session logs"
  ON public.user_session_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Authenticated users can insert their own logs (edge function will use service role typically)
CREATE POLICY "User inserts own session log"
  ON public.user_session_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- View: last establishment access (super_admin only via security_invoker)
CREATE OR REPLACE VIEW public.vw_last_establishment_access
WITH (security_invoker = true) AS
SELECT
  e.id,
  e.name,
  e.slug,
  e.subscription_plan,
  e.status,
  e.owner_id,
  p.full_name AS owner_name,
  (SELECT MAX(usl.session_start) FROM public.user_session_logs usl WHERE usl.establishment_id = e.id) AS last_access_at,
  (SELECT usl2.page_name FROM public.user_session_logs usl2 WHERE usl2.establishment_id = e.id ORDER BY usl2.session_start DESC LIMIT 1) AS last_page_accessed,
  (SELECT COUNT(DISTINCT DATE(usl3.session_start)) FROM public.user_session_logs usl3 WHERE usl3.establishment_id = e.id AND usl3.session_start >= date_trunc('month', now())) AS days_active_this_month,
  (SELECT COUNT(DISTINCT usl4.session_id) FROM public.user_session_logs usl4 WHERE usl4.establishment_id = e.id AND usl4.session_start >= date_trunc('month', now())) AS total_sessions_this_month,
  EXTRACT(DAY FROM now() - (SELECT MAX(usl5.session_start) FROM public.user_session_logs usl5 WHERE usl5.establishment_id = e.id))::int AS days_since_last_access
FROM public.establishments e
LEFT JOIN public.profiles p ON p.id = e.owner_id;

-- View: client registration status per establishment
CREATE OR REPLACE VIEW public.vw_client_registration_status
WITH (security_invoker = true) AS
SELECT
  e.id AS establishment_id,
  e.name AS establishment_name,
  COUNT(c.id)::int AS total_clients,
  COUNT(c.id) FILTER (WHERE c.password_hash IS NULL)::int AS clients_pending,
  COUNT(c.id) FILTER (WHERE c.password_hash IS NOT NULL)::int AS clients_complete,
  ROUND(
    COUNT(c.id) FILTER (WHERE c.password_hash IS NOT NULL)::numeric
    / NULLIF(COUNT(c.id), 0) * 100, 1
  ) AS completion_percentage,
  ROUND(
    COUNT(c.id) FILTER (WHERE c.password_hash IS NULL)::numeric
    / NULLIF(COUNT(c.id), 0) * 100, 1
  ) AS pending_percentage
FROM public.establishments e
LEFT JOIN public.clients c ON c.establishment_id = e.id
GROUP BY e.id, e.name;
