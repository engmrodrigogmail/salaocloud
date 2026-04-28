-- 1. Add 'in_service' to appointment_status enum
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'in_service' BEFORE 'completed';
