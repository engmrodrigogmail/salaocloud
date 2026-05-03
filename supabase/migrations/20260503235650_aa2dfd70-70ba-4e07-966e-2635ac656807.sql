ALTER TABLE public.client_hair_profiles
  ADD COLUMN IF NOT EXISTS client_self_assessment text,
  ADD COLUMN IF NOT EXISTS client_expected_result text,
  ADD COLUMN IF NOT EXISTS edu_personal_response text;