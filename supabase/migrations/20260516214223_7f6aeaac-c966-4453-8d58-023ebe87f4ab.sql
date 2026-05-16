
-- Soft-delete fields on tabs
ALTER TABLE public.tabs
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS deletion_reason text,
  ADD COLUMN IF NOT EXISTS deletion_mark text,
  ADD COLUMN IF NOT EXISTS recovered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tabs_is_deleted ON public.tabs(is_deleted);
CREATE INDEX IF NOT EXISTS idx_tabs_deleted_at ON public.tabs(deleted_at);

-- Audit table
CREATE TABLE IF NOT EXISTS public.tab_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id uuid NOT NULL REFERENCES public.tabs(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  deleted_by_user_id uuid NOT NULL,
  deleted_by_role text NOT NULL CHECK (deleted_by_role IN ('owner','manager')),
  deletion_reason text NOT NULL CHECK (deletion_reason IN ('duplicate','error','fraud','client_request','system_error','other')),
  deletion_notes text,
  original_tab_data jsonb NOT NULL,
  pin_verified boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text,
  recovered_at timestamptz,
  recovered_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tab_deletions_tab_id ON public.tab_deletions(tab_id);
CREATE INDEX IF NOT EXISTS idx_tab_deletions_establishment_id ON public.tab_deletions(establishment_id);
CREATE INDEX IF NOT EXISTS idx_tab_deletions_deleted_by_user_id ON public.tab_deletions(deleted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_tab_deletions_created_at ON public.tab_deletions(created_at DESC);

ALTER TABLE public.tab_deletions ENABLE ROW LEVEL SECURITY;

-- Visible to owner and managers of the establishment
CREATE POLICY "Owner and managers can view tab deletions"
  ON public.tab_deletions FOR SELECT
  USING (
    public.is_finance_authorized(establishment_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Writes only happen through SECURITY DEFINER edge functions (service role bypasses RLS).
-- No INSERT/UPDATE/DELETE policies for regular users.

-- Reuse demo write guard
DROP TRIGGER IF EXISTS prevent_demo_writes_on_tab_deletions ON public.tab_deletions;
CREATE TRIGGER prevent_demo_writes_on_tab_deletions
  BEFORE INSERT OR UPDATE OR DELETE ON public.tab_deletions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_demo_writes();

-- updated_at trigger
DROP TRIGGER IF EXISTS set_tab_deletions_updated_at ON public.tab_deletions;
CREATE TRIGGER set_tab_deletions_updated_at
  BEFORE UPDATE ON public.tab_deletions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
