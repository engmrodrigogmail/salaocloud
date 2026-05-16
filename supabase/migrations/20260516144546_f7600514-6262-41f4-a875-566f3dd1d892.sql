
ALTER TABLE public.manager_pin_audit
  ALTER COLUMN manager_professional_id DROP NOT NULL;

ALTER TABLE public.manager_pin_audit
  ADD COLUMN IF NOT EXISTS authorized_by_owner_user_id uuid;

ALTER TABLE public.manager_pin_audit
  DROP CONSTRAINT IF EXISTS manager_pin_audit_authorizer_present;

ALTER TABLE public.manager_pin_audit
  ADD CONSTRAINT manager_pin_audit_authorizer_present
  CHECK (
    manager_professional_id IS NOT NULL
    OR authorized_by_owner_user_id IS NOT NULL
  );
