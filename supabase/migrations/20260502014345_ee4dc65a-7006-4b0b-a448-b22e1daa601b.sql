INSERT INTO public.platform_settings (key, value, description)
VALUES ('signups_enabled', 'true', 'Controla se novos cadastros de salões estão abertos na tela /auth')
ON CONFLICT (key) DO NOTHING;