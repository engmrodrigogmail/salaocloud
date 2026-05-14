DELETE FROM public.training_certificates
WHERE user_id IN ('00000000-0000-0000-0000-0000000000aa', '2f15238e-cf71-4e70-ada3-95d3a89f7d2a');

DELETE FROM public.training_user_progress
WHERE user_id IN ('00000000-0000-0000-0000-0000000000aa', '2f15238e-cf71-4e70-ada3-95d3a89f7d2a');