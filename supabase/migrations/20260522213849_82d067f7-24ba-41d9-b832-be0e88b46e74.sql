
-- ============================================================
-- 1) appointment_reminders: drop the "System can manage reminders" (USING true) policy.
--    Service-role (cron) bypasses RLS, so no functional impact.
-- ============================================================
DROP POLICY IF EXISTS "System can manage reminders" ON public.appointment_reminders;

-- ============================================================
-- 2) ai_conversation_feedback: drop the public "Service role full access" policy.
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to feedback" ON public.ai_conversation_feedback;

-- ============================================================
-- 3) establishment_ai_learnings: drop the public "Service role full access" policy.
-- ============================================================
DROP POLICY IF EXISTS "Service role full access to learnings" ON public.establishment_ai_learnings;

-- ============================================================
-- 4) services_audit_log: tighten INSERT (no public inserts; service role bypasses RLS).
-- ============================================================
DROP POLICY IF EXISTS "System inserts audit" ON public.services_audit_log;

-- ============================================================
-- 5) establishment_ai_subscriptions: drop the public-INSERT trial policy.
--    Only the owner can create a subscription for their own establishment.
-- ============================================================
DROP POLICY IF EXISTS "Public can insert subscription for trial" ON public.establishment_ai_subscriptions;

CREATE POLICY "Owners can create subscription for own establishment"
ON public.establishment_ai_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  establishment_id IN (
    SELECT id FROM public.establishments WHERE owner_id = auth.uid()
  )
);

-- ============================================================
-- 6) ai_assistant_conversations / ai_assistant_messages:
--    These tables are only consumed by portal (owner) pages.
--    Drop the public read/write/update policies; rely on owner policies
--    plus service-role for writes from edge functions.
-- ============================================================
DROP POLICY IF EXISTS "Public can view their own conversations" ON public.ai_assistant_conversations;
DROP POLICY IF EXISTS "Public can update conversations" ON public.ai_assistant_conversations;
DROP POLICY IF EXISTS "Public can create conversations" ON public.ai_assistant_conversations;

DROP POLICY IF EXISTS "Public can view messages" ON public.ai_assistant_messages;
DROP POLICY IF EXISTS "Public can insert messages" ON public.ai_assistant_messages;

-- Owner read for messages (via conversation join)
CREATE POLICY "Owners view ai messages"
ON public.ai_assistant_messages
FOR SELECT
TO authenticated
USING (
  conversation_id IN (
    SELECT c.id FROM public.ai_assistant_conversations c
    JOIN public.establishments e ON e.id = c.establishment_id
    WHERE e.owner_id = auth.uid()
  )
);

-- ============================================================
-- 7) clients.password_hash: revoke column SELECT from anon/authenticated.
--    Only edge functions (service_role, which bypasses column ACLs) use it.
-- ============================================================
REVOKE SELECT (password_hash) ON public.clients FROM anon, authenticated;

-- ============================================================
-- 8) Storage policies — add path-based ownership to logos, broadcast images,
--    and professional avatars.
-- ============================================================

-- establishment-logos: path is "{establishment_id}/..."
DROP POLICY IF EXISTS "Establishment owners can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Establishment owners can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Establishment owners can delete logos" ON storage.objects;

CREATE POLICY "Owners upload logos to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'establishment-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.establishments WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Owners update logos in own folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'establishment-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.establishments WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Owners delete logos in own folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'establishment-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.establishments WHERE owner_id = auth.uid()
  )
);

-- broadcast-images
DROP POLICY IF EXISTS "Establishments can upload broadcast images" ON storage.objects;
DROP POLICY IF EXISTS "Establishments can delete their own broadcast images" ON storage.objects;

CREATE POLICY "Owners upload broadcast images to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'broadcast-images'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.establishments WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Owners delete broadcast images from own folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'broadcast-images'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.establishments WHERE owner_id = auth.uid()
  )
);

-- professional-avatars: path is "{establishment_id}/..."
DROP POLICY IF EXISTS "Authenticated users can upload professional avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update professional avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete professional avatars" ON storage.objects;

CREATE POLICY "Owners or staff upload avatars to own est folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'professional-avatars'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.establishments WHERE owner_id = auth.uid()
    )
    OR (storage.foldername(name))[1] = (public.get_professional_establishment_id(auth.uid()))::text
  )
);

CREATE POLICY "Owners or staff update avatars in own est folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'professional-avatars'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.establishments WHERE owner_id = auth.uid()
    )
    OR (storage.foldername(name))[1] = (public.get_professional_establishment_id(auth.uid()))::text
  )
);

CREATE POLICY "Owners or staff delete avatars in own est folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'professional-avatars'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.establishments WHERE owner_id = auth.uid()
    )
    OR (storage.foldername(name))[1] = (public.get_professional_establishment_id(auth.uid()))::text
  )
);
