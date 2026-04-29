-- Remove trigger function that auto-syncs appointment status from tab.
-- Sync will be handled at the application layer (useTabs hook) to avoid
-- side effects like resurrecting cancelled/completed appointments when tabs reopen.
DROP TRIGGER IF EXISTS trg_sync_appointment_status_from_tab ON public.tabs;
DROP TRIGGER IF EXISTS sync_appointment_status_from_tab ON public.tabs;
DROP FUNCTION IF EXISTS public.sync_appointment_status_from_tab() CASCADE;