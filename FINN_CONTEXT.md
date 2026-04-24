# Finn — Assistente Financeiro para Casais via WhatsApp

## O que é

Finn é um assistente financeiro conversacional que funciona 100% pelo WhatsApp. Não tem dashboard — toda a UX é via mensagens de texto, áudio e imagens. Voltado para casais (mas suporta uso individual também).

## Tech Stack

- **Next.js 15** (App Router) + **Vercel** — hospedagem e API routes
- **Supabase** (PostgreSQL) — banco de dados com RLS
- **Claude Haiku** (Anthropic) — interpretação de linguagem natural
- **Z-API** — integração com WhatsApp
- **Groq** — transcrição de áudio (Whisper)

## Features principais

### Registro de gastos e receitas
Usuário manda uma mensagem como "gastei 50 reais no mercado" ou "recebi meu salário de 3000" — o Claude interpreta e salva automaticamente com categoria, valor e data.

### Suporte a imagens e áudio
- Fotos de nota fiscal ou cupom fiscal → Claude lê e registra a transação
- Mensagens de voz → transcrição via Whisper → processamento normal

### Modo casal
- Dois usuários vinculados num mesmo `couple_id`
- Transações de ambos são registradas com vínculo ao casal
- Suporte a grupos WhatsApp (o bot opera dentro de um grupo compartilhado)

### Onboarding conversacional
Ao entrar pela primeira vez, o Finn coleta:
1. Apelido do usuário
2. Meta financeira (ex: reserva de emergência, viagem, casa própria)
3. Valor da meta ou renda mensal
4. Meta de poupança mensal

Com isso calcula um **financial_score** inicial do usuário/casal.

### Edição de perfil
Usuário pode editar qualquer campo do perfil (renda, meta, apelido etc.) diretamente pelo chat, sem formulário.

### Financial Score
Score calculado com base em renda, poupança mensal, meta financeira e progresso. Atualizado dinamicamente conforme o usuário usa o app.

### Cadastro web (landing page)
- Landing page em Next.js para aquisição
- Login com Google ou email
- Formulário pós-login para vincular número de WhatsApp e (opcionalmente) cadastrar parceiro

## Fluxo de uma mensagem

```
WhatsApp → Z-API → POST /api/webhook
  → validação (token, HMAC, rate limit, deduplicação)
  → mídia? (imagem/áudio) → processamento específico
  → busca usuário por telefone
  → onboarding incompleto? → continua onboarding
  → editando campo? → salva edição
  → senão → processFinanceMessage (Claude interpreta e salva transação)
  → resposta via Z-API de volta ao WhatsApp
```

## Tabelas principais

- **users** — perfil, onboarding, metas, score
- **transactions** — gastos e receitas com categoria
- **messages** — histórico de conversa (com deduplicação por keyId)
- **couples** — vínculo entre dois usuários
