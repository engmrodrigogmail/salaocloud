-- One-time: reset password do dono do salão Teste SaaS e exigir troca no próximo acesso
DO $$
DECLARE v_owner uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM public.establishments WHERE id = '4420d411-f7bc-4a80-a858-87c87c695c4d';
  IF v_owner IS NOT NULL THEN
    UPDATE auth.users
       SET encrypted_password = extensions.crypt('123mudar', extensions.gen_salt('bf')),
           raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('must_change_password', true),
           updated_at = now()
     WHERE id = v_owner;
  END IF;
END $$;