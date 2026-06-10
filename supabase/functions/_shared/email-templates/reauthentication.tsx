/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
  siteName?: string
}

export const ReauthenticationEmail = ({ token, siteName = 'salaocloud' }: ReauthenticationEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de verificação</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>{siteName}</Text></Section>
        <Heading style={h1}>Confirme sua identidade</Heading>
        <Text style={text}>Use o código abaixo para confirmar sua identidade:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={text}>
          Este código expira em breve. Se você não solicitou esta verificação,
          pode ignorar este email com segurança.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>Enviado por {siteName} • notify.salaocloud.com.br</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px' }
const header = { padding: '8px 0 16px' }
const brand = { fontSize: '20px', fontWeight: 'bold' as const, color: '#C18A53', margin: 0, letterSpacing: '0.5px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#444', lineHeight: '1.6', margin: '0 0 16px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '28px', fontWeight: 'bold' as const, color: '#C18A53', letterSpacing: '4px', textAlign: 'center' as const, margin: '24px 0' }
const hr = { borderColor: '#eee', margin: '24px 0 12px' }
const footer = { fontSize: '12px', color: '#999', margin: 0 }
