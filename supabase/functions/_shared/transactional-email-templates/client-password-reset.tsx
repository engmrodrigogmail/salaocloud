/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface ClientPasswordResetProps {
  name?: string
  establishmentName?: string
  resetUrl?: string
  expiresInMinutes?: number
}

const ClientPasswordResetEmail = ({
  name,
  establishmentName,
  resetUrl = 'https://salaocloud.com.br',
  expiresInMinutes = 30,
}: ClientPasswordResetProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Redefina sua senha de acesso ao Salão Cloud</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `Olá, ${name}!` : 'Olá!'}
        </Heading>
        <Text style={text}>
          Recebemos um pedido para redefinir a senha de acesso da sua conta de
          cliente {establishmentName ? `do ${establishmentName}` : ''} no Salão Cloud.
        </Text>
        <Text style={text}>
          Clique no botão abaixo para criar uma nova senha. Este link é único e
          expira em {expiresInMinutes} minutos.
        </Text>
        <Section style={buttonSection}>
          <Button href={resetUrl} style={button}>
            Redefinir minha senha
          </Button>
        </Section>
        <Text style={textSmall}>
          Se o botão não funcionar, copie e cole este endereço no navegador:
        </Text>
        <Text style={linkText}>
          <Link href={resetUrl} style={link}>{resetUrl}</Link>
        </Text>
        <Text style={footer}>
          Se você não solicitou a redefinição, pode ignorar este e-mail com
          segurança — sua senha atual continuará valendo.
        </Text>
        <Text style={signature}>Equipe Salão Cloud</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ClientPasswordResetEmail,
  subject: 'Redefina sua senha — Salão Cloud',
  displayName: 'Redefinição de senha (cliente do salão)',
  previewData: {
    name: 'Manoel',
    establishmentName: 'Salão Exemplo',
    resetUrl: 'https://salaocloud.com.br/cliente/redefinir-senha?token=exemplo',
    expiresInMinutes: 30,
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}
const container = { padding: '32px 24px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#1a1a1a', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#444', lineHeight: '1.6', margin: '0 0 16px' }
const textSmall = { fontSize: '13px', color: '#666', margin: '24px 0 4px' }
const linkText = { fontSize: '13px', color: '#666', margin: '0 0 24px', wordBreak: 'break-all' as const }
const link = { color: '#5b21b6', textDecoration: 'underline' }
const buttonSection = { textAlign: 'center' as const, margin: '28px 0' }
const button = {
  backgroundColor: '#5b21b6',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: '600',
  display: 'inline-block',
}
const footer = { fontSize: '13px', color: '#888', margin: '24px 0 8px', lineHeight: '1.5' }
const signature = { fontSize: '13px', color: '#666', margin: '20px 0 0', fontWeight: '500' }
