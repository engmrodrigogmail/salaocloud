/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu link de acesso ao {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>{siteName}</Text></Section>
        <Heading style={h1}>Seu link de acesso</Heading>
        <Text style={text}>
          Clique no botão abaixo para entrar no {siteName}. Este link expira em breve.
        </Text>
        <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
          <Button style={button} href={confirmationUrl}>Entrar agora</Button>
        </Section>
        <Text style={text}>
          Se você não solicitou este link, pode ignorar este email com segurança.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>Enviado por {siteName} • notify.salaocloud.com.br</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px' }
const header = { padding: '8px 0 16px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: '#C18A53', margin: 0, letterSpacing: '0.5px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#444', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#C18A53', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '12px 24px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#eee', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#999', margin: 0 }
