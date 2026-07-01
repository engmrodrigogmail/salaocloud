INSERT INTO public.whatsapp_message_types (key, label, description, template, is_active)
VALUES (
  'new_signup',
  'Novo cadastro de salão',
  'Enviado imediatamente quando um novo salão se cadastra no SaaS.',
  E'Novo Cadastro Salão Cloud\n\nNome do salão: {{salon_name}}\nNome do dono: {{owner_name}}',
  true
)
ON CONFLICT (key) DO NOTHING;