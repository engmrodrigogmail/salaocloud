
-- Módulo 8 (Comissões - Portal/Admin): adicionar info sobre recibo
UPDATE public.training_modules
SET content = jsonb_set(
  jsonb_set(
    content,
    '{technical}',
    to_jsonb(
      (content->>'technical') ||
      ' Após "Pagar selecionadas" (ou no botão "Recibo" de cada linha paga) o sistema oferece gerar **recibo em PDF** — um por profissional, com nome do salão, valor por extenso, tabela detalhada e duas assinaturas (responsável pelo salão em cima, profissional embaixo, divididas por linha horizontal). Assinaturas são descartadas após gerar; reemissão exige nova coleta. Reemissão agrupa todas as comissões do mesmo profissional pagas no mesmo acerto (mesmo minuto de paid_at). Responsável que pode assinar: dono ou qualquer gerente.'
    )
  ),
  '{quiz}',
  (content->'quiz') || jsonb_build_array(
    jsonb_build_object(
      'q', 'Sobre o recibo de pagamento de comissão, o que é VERDADE?',
      'a', jsonb_build_array(
        'Gera um recibo por profissional e as assinaturas são apagadas após o PDF ser criado',
        'Gera um único recibo com todos os profissionais e as assinaturas ficam salvas no banco',
        'Só o dono pode assinar; gerente não pode'
      ),
      'correct', 0
    )
  )
)
WHERE id = 8;

-- Módulo 23 (Comissões - Interno/Profissional): mencionar recibo do lado do funcionário
UPDATE public.training_modules
SET content = jsonb_set(
  content,
  '{technical}',
  to_jsonb(
    (content->>'technical') ||
    ' No momento do acerto, o profissional pode assinar o **recibo em PDF** (na tela aberta pelo dono/gerente) — sua assinatura aparece embaixo da do responsável pelo salão, com seu nome impresso logo abaixo. O recibo gerado pode ser compartilhado por WhatsApp.'
  )
)
WHERE id = 23;
