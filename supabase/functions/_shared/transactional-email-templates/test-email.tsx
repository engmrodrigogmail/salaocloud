/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Salão Cloud'

interface TestEmailProps {
  recipientName?: string
  sentAt?: string
}

const TestEmail = ({ recipientName, sentAt }: TestEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>E-mail de teste do {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>✅ E-mail de teste enviado com sucesso</Heading>
        <Text style={text}>
          {recipientName ? `Olá, ${recipientName}!` : 'Olá!'}
        </Text>
        <Text style={text}>
          Este é um e-mail automático de teste enviado pelo {SITE_NAME} para
          confirmar que a infraestrutura de envio está funcionando corretamente
          através do domínio <strong>notify.salaocloud.com.br</strong>.
        </Text>
        <Section style={infoBox}>
          <Text style={infoLabel}>Detalhes do envio</Text>
          <Text style={infoItem}>
            <strong>Plataforma:</strong> {SITE_NAME}
          </Text>
          <Text style={infoItem}>
            <strong>Data/Hora:</strong> {sentAt || new Date().toLocaleString('pt-BR')}
          </Text>
          <Text style={infoItem}>
            <strong>Status:</strong> Entregue com sucesso
          </Text>
        </Section>
        <Text style={text}>
          Se você recebeu este e-mail, significa que o sistema de notificações
          está pronto para uso em produção.
        </Text>
        <Text style={footer}>
          Atenciosamente,<br />
          Equipe {SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TestEmail,
  subject: 'E-mail de teste — Salão Cloud',
  displayName: 'E-mail de teste',
  previewData: { recipientName: 'Rodrigo', sentAt: new Date().toLocaleString('pt-BR') },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}
const container = { padding: '32px 24px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 24px',
}
const text = {
  fontSize: '15px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const infoBox = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '24px 0',
}
const infoLabel = {
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 8px',
}
const infoItem = {
  fontSize: '14px',
  color: '#334155',
  margin: '4px 0',
}
const footer = {
  fontSize: '13px',
  color: '#94a3b8',
  margin: '32px 0 0',
}
