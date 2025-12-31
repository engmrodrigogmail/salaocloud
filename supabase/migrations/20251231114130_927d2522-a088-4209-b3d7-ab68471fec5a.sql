-- Add complex rule fields to commission_rules table
ALTER TABLE public.commission_rules
ADD COLUMN IF NOT EXISTS product_brand TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS days_of_week INTEGER[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS time_start TIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS time_end TIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS client_ids UUID[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN public.commission_rules.product_brand IS 'Brand filter for product-specific commission rules';
COMMENT ON COLUMN public.commission_rules.days_of_week IS 'Days of week filter: 0=Sunday, 1=Monday, etc.';
COMMENT ON COLUMN public.commission_rules.time_start IS 'Start time for time-based commission rules';
COMMENT ON COLUMN public.commission_rules.time_end IS 'End time for time-based commission rules';
COMMENT ON COLUMN public.commission_rules.client_ids IS 'Specific client IDs this rule applies to';
COMMENT ON COLUMN public.commission_rules.priority IS 'Priority for rule matching (higher = more priority)';

-- Add recognized/verified status to tabs
ALTER TABLE public.tabs
ADD COLUMN IF NOT EXISTS recognized_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recognized_by UUID DEFAULT NULL;

COMMENT ON COLUMN public.tabs.recognized_at IS 'When the tab was officially recognized for financial control';
COMMENT ON COLUMN public.tabs.recognized_by IS 'User who recognized the tab';

-- Add audit fields to professional_commissions
ALTER TABLE public.professional_commissions
ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tab_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS justification TEXT DEFAULT NULL;

-- Add foreign key for tab_id
ALTER TABLE public.professional_commissions
ADD CONSTRAINT professional_commissions_tab_id_fkey 
FOREIGN KEY (tab_id) REFERENCES public.tabs(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.professional_commissions.created_by IS 'User who created or modified this commission';
COMMENT ON COLUMN public.professional_commissions.is_manual IS 'Whether this is a manually added commission';
COMMENT ON COLUMN public.professional_commissions.justification IS 'Justification for manual commissions';

-- Create commission audit log table
CREATE TABLE IF NOT EXISTS public.commission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID NOT NULL REFERENCES public.professional_commissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB DEFAULT NULL,
  new_values JSONB DEFAULT NULL,
  justification TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_audit_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.commission_audit_log IS 'Audit log for all commission changes';

-- RLS policies for commission_audit_log
CREATE POLICY "Establishment owners can view commission audit logs"
ON public.commission_audit_log
FOR SELECT
USING (
  commission_id IN (
    SELECT pc.id FROM public.professional_commissions pc
    WHERE pc.establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_id = auth.uid()
    )
  )
);

CREATE POLICY "Establishment owners can insert audit logs"
ON public.commission_audit_log
FOR INSERT
WITH CHECK (
  commission_id IN (
    SELECT pc.id FROM public.professional_commissions pc
    WHERE pc.establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_id = auth.uid()
    )
  )
);

CREATE POLICY "Super admins can manage all audit logs"
ON public.commission_audit_log
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Update professional_commissions RLS to allow establishment owners to insert
CREATE POLICY "Establishment owners can insert commissions"
ON public.professional_commissions
FOR INSERT
WITH CHECK (establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid()));

CREATE POLICY "Establishment owners can update commissions"
ON public.professional_commissions
FOR UPDATE
USING (establishment_id IN (SELECT id FROM establishments WHERE owner_id = auth.uid()));