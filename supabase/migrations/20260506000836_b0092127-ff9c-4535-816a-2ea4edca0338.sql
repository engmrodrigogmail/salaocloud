-- Tabela de auditoria
CREATE TABLE public.services_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id uuid NOT NULL,
  service_id uuid NOT NULL,
  service_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('delete','update')),
  old_data jsonb,
  new_data jsonb,
  performed_by uuid,
  performed_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_audit_log_est ON public.services_audit_log(establishment_id, performed_at DESC);
CREATE INDEX idx_services_audit_log_purge ON public.services_audit_log(performed_at);

ALTER TABLE public.services_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their services audit"
ON public.services_audit_log FOR SELECT
USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_id = auth.uid()));

CREATE POLICY "Super admins manage services audit"
ON public.services_audit_log FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "System inserts audit"
ON public.services_audit_log FOR INSERT
WITH CHECK (true);

-- Trigger function
CREATE OR REPLACE FUNCTION public.log_service_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.services_audit_log (
      establishment_id, service_id, service_name, action, old_data, performed_by
    ) VALUES (
      OLD.establishment_id, OLD.id, OLD.name, 'delete', to_jsonb(OLD), auth.uid()
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Apenas registra se houve mudança real em campos relevantes
    IF OLD.name IS DISTINCT FROM NEW.name
       OR OLD.price IS DISTINCT FROM NEW.price
       OR OLD.duration_minutes IS DISTINCT FROM NEW.duration_minutes
       OR OLD.description IS DISTINCT FROM NEW.description
       OR OLD.is_active IS DISTINCT FROM NEW.is_active
       OR OLD.category_id IS DISTINCT FROM NEW.category_id THEN
      INSERT INTO public.services_audit_log (
        establishment_id, service_id, service_name, action, old_data, new_data, performed_by
      ) VALUES (
        NEW.establishment_id, NEW.id, NEW.name, 'update', to_jsonb(OLD), to_jsonb(NEW), auth.uid()
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_services_audit_delete
AFTER DELETE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.log_service_changes();

CREATE TRIGGER trg_services_audit_update
AFTER UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.log_service_changes();

-- Função de expurgo
CREATE OR REPLACE FUNCTION public.purge_services_audit_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.services_audit_log WHERE performed_at < now() - interval '7 days';
$$;

-- Agenda diária do expurgo
SELECT cron.schedule(
  'purge-services-audit-log-daily',
  '15 3 * * *',
  $$ SELECT public.purge_services_audit_log(); $$
);