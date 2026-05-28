INSERT INTO public.training_modules (id, title, profile, view, display_order, is_active, content)
VALUES (
  30,
  'Instalação do App (PWA) & Notificações Push',
  'admin',
  'portal',
  30,
  true,
  $json$
{
  "commercial": "O Salão Cloud funciona como um aplicativo no celular do dono, profissionais e clientes — sem precisar baixar nada da loja. Lembretes de agendamento, novos clientes e mensagens chegam direto na tela do celular, mesmo bloqueada, como se fosse WhatsApp. Argumento de venda forte: 'esquece de anotar — o sistema te avisa'.",
  "technical": "É um PWA (Progressive Web App). O cliente instala adicionando à tela inicial pelo navegador (Chrome no Android, Safari no iPhone). As notificações são Web Push com VAPID, enviadas com prioridade alta. Para chegar com o celular bloqueado, o sistema operacional precisa estar configurado para permitir notificações na tela bloqueada para o app SalãoCloud.",
  "differentials": [
    "Funciona como app sem passar pela App Store / Play Store",
    "Notificações push de verdade (não SMS, não e-mail)",
    "Mesmo código no iPhone e Android",
    "Atualização automática, sem o usuário precisar baixar nova versão"
  ],
  "arguments": {
    "small": [
      "Instala como app, sem ocupar espaço",
      "Notifica quando tem agendamento novo"
    ],
    "medium": [
      "Dono, profissional, recepcionista e cliente — todos podem instalar",
      "Lembrete automático antes do horário do cliente"
    ],
    "large": [
      "Comunicação em tempo real com toda a equipe pelo celular",
      "Reduz no-show porque o cliente é avisado e confirma pelo próprio app"
    ]
  },
  "use_cases": [
    "Dono recebe push quando cliente agenda pelo site, mesmo com celular no bolso",
    "Profissional vê na tela bloqueada que tem horário novo na agenda dele",
    "Cliente confirma presença pelo push do lembrete (reduz falta)"
  ],
  "checklist": [
    "Saber instalar o PWA no Android (Chrome → menu → 'Instalar app' / 'Adicionar à tela inicial')",
    "Saber instalar o PWA no iPhone (Safari → botão Compartilhar → 'Adicionar à Tela de Início')",
    "Saber explicar que 'notificações', 'mensagens', 'balõezinhos' e 'avisos' são tudo a mesma coisa (push)",
    "Saber o passo a passo Android para liberar push na tela bloqueada (Configurações → Apps → SalãoCloud → Notificações → Permitir + Geral → Tela bloqueada)",
    "Saber o passo a passo iPhone para liberar push na tela bloqueada (Ajustes → Notificações → SalãoCloud → Permitir + Tela Bloqueada / Central / Faixas)",
    "Lembrar o cliente de desativar 'Não perturbe' / 'Foco' se quiser ouvir o som",
    "Reforçar que o PWA precisa estar instalado na tela inicial para receber push (não funciona só com o site aberto no navegador)"
  ],
  "quiz": [
    {
      "q": "O que é o aplicativo do Salão Cloud?",
      "a": [
        "Um app da Play Store / App Store que precisa ser baixado",
        "Um PWA instalado pelo navegador, direto na tela inicial",
        "Um software de computador que roda só no PC"
      ],
      "correct": 1
    },
    {
      "q": "O cliente diz: 'as mensagens só chegam quando desbloqueio o celular'. O que orientar?",
      "a": [
        "Reinstalar o sistema operacional do celular",
        "Liberar notificações na tela bloqueada nas configurações do celular (Apps → SalãoCloud → Notificações → Geral → Tela bloqueada no Android, ou Ajustes → Notificações → SalãoCloud → Tela Bloqueada no iPhone)",
        "Pedir para o cliente trocar de celular"
      ],
      "correct": 1
    },
    {
      "q": "Cliente fala 'não estou recebendo os balõezinhos' — o que ele quer dizer?",
      "a": [
        "Está falando de mensagens do WhatsApp",
        "É a mesma coisa que notificação push do app",
        "É um problema de internet"
      ],
      "correct": 1
    },
    {
      "q": "Para receber push, o cliente precisa:",
      "a": [
        "Manter só o site aberto no navegador",
        "Ter o PWA instalado na tela inicial do celular",
        "Pagar um plano à parte"
      ],
      "correct": 1
    }
  ]
}
$json$::jsonb
)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    profile = EXCLUDED.profile,
    view = EXCLUDED.view,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    content = EXCLUDED.content,
    updated_at = now();