CREATE POLICY "Anyone can register as client in establishment"
ON public.clients
FOR INSERT
TO anon, authenticated
WITH CHECK (
  establishment_id IS NOT NULL
  AND name IS NOT NULL
  AND phone IS NOT NULL
  AND user_id IS NULL
);