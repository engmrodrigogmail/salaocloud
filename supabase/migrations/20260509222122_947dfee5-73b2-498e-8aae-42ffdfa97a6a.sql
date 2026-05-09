
ALTER TABLE public.edu_access_control
  ADD COLUMN IF NOT EXISTS edu_profile TEXT NOT NULL DEFAULT 'tecnico';

ALTER TABLE public.edu_access_control
  DROP CONSTRAINT IF EXISTS edu_access_control_edu_profile_check;

ALTER TABLE public.edu_access_control
  ADD CONSTRAINT edu_access_control_edu_profile_check
  CHECK (edu_profile IN ('tecnico', 'acolhedor'));

-- Pré-seleciona Hair Company com perfil acolhedor
UPDATE public.edu_access_control
SET edu_profile = 'acolhedor'
WHERE establishment_id IN (
  SELECT id FROM public.establishments WHERE name ILIKE '%hair company%'
);

-- Política para o dono do salão atualizar o próprio perfil do Edu
DROP POLICY IF EXISTS "Dono atualiza perfil edu" ON public.edu_access_control;
CREATE POLICY "Dono atualiza perfil edu"
ON public.edu_access_control
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.establishments e
  WHERE e.id = edu_access_control.establishment_id
    AND e.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.establishments e
  WHERE e.id = edu_access_control.establishment_id
    AND e.owner_id = auth.uid()
));
