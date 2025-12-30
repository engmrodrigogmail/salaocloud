-- Add agenda settings columns to establishments table
ALTER TABLE public.establishments
ADD COLUMN IF NOT EXISTS agenda_slot_interval INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS agenda_expand_hours INTEGER DEFAULT 1;

-- Add comments for documentation
COMMENT ON COLUMN public.establishments.agenda_slot_interval IS 'Time slot interval in minutes for agenda view (15, 30, 60)';
COMMENT ON COLUMN public.establishments.agenda_expand_hours IS 'Hours to expand before/after working hours in agenda view';