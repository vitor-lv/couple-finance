# Finn — Contexto Completo do Projeto

## O produto

**Finn** é um assistente financeiro para casais (e uso individual) que funciona **100% via WhatsApp**. Não tem app para baixar, não tem dashboard web — a interface é o próprio chat. O usuário manda uma mensagem em linguagem natural ("gastei 50 no mercado", "qual meu saldo?") e o Finn interpreta, salva e responde.

**Posicionamento:** "Chega de planilhas chatas e complexas — o melhor assistente de finanças direto no WhatsApp."

**Público-alvo:** Casais brasileiros que querem controle financeiro conjunto sem fricção.

---

## O que o Finn faz hoje

- Registrar gastos e receitas por **texto**, **imagem** (foto de nota fiscal/comprovante) e **áudio**
- Categorização automática via IA (alimentação, transporte, moradia, saúde, lazer, etc.)
- Resumo de gastos e saldo do mês
- Metas financeiras com acompanhamento de progresso
- Suporte a **modo individual** e **modo casal** (grupo WhatsApp compartilhado)
- Edição de perfil (apelido, renda, meta, gastos fixos) via conversa
- Onboarding conversacional — o Claude coleta as informações de forma natural

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Estilo | Tailwind CSS 4 |
| Banco | Supabase (PostgreSQL + RLS) |
| AI | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) via Anthropic SDK |
| Áudio | Groq API (Whisper large v3) via OpenAI SDK |
| WhatsApp | Z-API (instância própria) |
| Deploy | Vercel |

---

## Estrutura de arquivos

```
src/
├── app/
│   ├── page.tsx                        # Landing page
│   ├── completar-cadastro/page.tsx     # Formulário de cadastro (individual / casal)
│   ├── sucesso/page.tsx                # Confirmação pós-cadastro com CTA pro WhatsApp
│   └── api/
│       ├── webhook/route.ts            # HUB PRINCIPAL — recebe toda mensagem da Z-API
│       └── completar-cadastro/route.ts # Cria usuário(s) no Supabase
└── lib/
    ├── claude.ts       # Todas as chamadas à API Claude (onboarding + fluxo normal)
    ├── onboarding.ts   # Lógica dos steps de onboarding + edição de perfil
    ├── zapi.ts         # Integração Z-API (sendTextMessage, sendTyping, createGroup)
    ├── supabase.ts     # Client admin (service_role) para uso no server
    └── supabase-browser.ts  # Client público (anon key) para uso no frontend

supabase/schema.sql     # Schema completo — rodar no SQL Editor pra recriar o banco
```

---

## Banco de dados (Supabase)

### `users`
Coluna | Tipo | Descrição
---|---|---
`phone` | text | Identificador principal (sem formatação, ex: `5511999999999`)
`name` | text | Nome real (vem do formulário ou do WhatsApp)
`email` | text | Email (opcional, vem do formulário)
`nickname` | text | Apelido escolhido no onboarding
`couple_id` | uuid | FK para `couples` (null se individual)
`chat_mode` | text | `'individual'` ou `'group'`
`group_id` | text | JID do grupo WhatsApp (só no modo casal)
`onboarding_step` | integer | Passo atual do onboarding (-1 a 5)
`onboarding_completed` | boolean | `true` libera o fluxo normal
`editing_field` | text | Campo sendo editado no momento (ex: `'monthly_income'`)
`monthly_income` | numeric | Renda mensal
`goal_description` | text | Descrição da meta (ex: "Viagem para Europa")
`goal_amount` | numeric | Valor da meta em reais
`fixed_expenses` | numeric | Gastos fixos mensais
`employment_type` | text | ⚠️ **Reaproveitado como `goal_category`** (ex: `reserva_emergencia`, `viagem`)

### `couples`
Coluna | Tipo | Descrição
---|---|---
`id` | uuid | PK
`group_id` | text | JID do grupo WhatsApp
`chat_mode` | text | `'individual'` ou `'group'`
`goal_name` | text | Meta do casal
`goal_amount` | numeric | Valor da meta
`financial_score` | integer | Score 0-100 (não implementado ainda)

### `transactions`
Coluna | Tipo | Descrição
---|---|---
`phone` | text | Quem registrou
`tipo` | text | `'gasto'` ou `'receita'`
`valor` | numeric | Valor (campo principal usado pelo Finn)
`categoria` | text | Categoria (alimentação, transporte, etc.)
`descricao` | text | Descrição livre
`data` | text | Data ISO 8601 (ex: `2026-04-19`)
`amount` / `category` / `description` | — | Colunas espelho do schema original — **ambas são salvas**

### `messages`
Histórico de conversa por `phone`. Usado para contexto (últimas 10 msgs) e rate limiting (20 msgs/min).

---

## Fluxo do webhook (`/api/webhook`)

```
Z-API → POST /api/webhook
  → valida header: z-api-token
  → ignora mensagens enviadas por mim (fromMe)
  → identifica: é grupo? → separa userPhone do replyTo
  → rate limit: 20 msgs/min por número individual
  → sendTyping()
  → trata imagem → processFinanceImage()
  → trata áudio  → transcribeAudio() → vira texto
  → busca usuário pelo phone no Supabase
  → se não existe: cria com onboarding_step=-1

  PRIORIDADE DE PROCESSAMENTO:
  1. editing_field ativo?          → processEditValue()
  2. onboarding_completed = false? → processOnboardingStep()
  3. Normal                        → processFinanceMessage() via Claude
```

---

## Onboarding (steps)

| Step | Descrição |
|---|---|
| -1 | Primeira mensagem → envia boas-vindas, avança para 0 |
| 0 | Pede apelido → `interpretNickname()` |
| 1 | Pede meta financeira → `interpretGoal()` → salva `goal_description` + `employment_type` (= goal_category) |
| 2 | Pede valor — se `reserva_emergencia`: pede renda e calcula 6x; senão: pede o valor da meta direto |
| 3 | Confirma valor sugerido (só `reserva_emergencia`) → `interpretGoalConfirmation()` |
| 5 + `completed=true` | Fluxo normal liberado |

**No modo casal:** step 1 espera ambos terem apelido antes de pedir a meta. O step 0 do parceiro é tratado dentro do step 0 do usuário principal.

---

## Tipos de resposta do Claude (fluxo normal)

O `processFinanceMessage()` retorna um JSON com o campo `tipo`:

| tipo | O que acontece |
|---|---|
| `gasto` | Salva em `transactions` + confirma no chat |
| `receita` | Salva em `transactions` + confirma no chat |
| `ver_perfil` | Exibe perfil formatado (nickname, renda, meta, valor) |
| `editar_perfil` | Exibe menu com 5 campos editáveis |
| `resetar_perfil` | Zera todos os campos e reinicia onboarding |
| `salvar_renda` | Atualiza `monthly_income` sem interromper a conversa |
| `consulta` / `outro` | Só responde em texto, sem salvar nada |

---

## Chamadas ao Claude (`src/lib/claude.ts`)

| Função | Uso |
|---|---|
| `interpretNickname(msg)` | Extrai apelido de uma mensagem livre |
| `interpretGoal(msg)` | Classifica a meta em categoria + descrição curta |
| `interpretMoneyValue(msg)` | Extrai valor numérico ("uns 15 mil" → 15000) |
| `interpretGoalConfirmation(msg, suggested)` | Decide se aceita ou personaliza o valor sugerido |
| `interpretEditValue(field, value)` | Interpreta o novo valor para edição de perfil |
| `processFinanceMessage(msg, history, ctx)` | Fluxo normal — classifica e responde |
| `processFinanceImage(base64, caption)` | Analisa imagem de comprovante/nota |
| `transcribeAudio(url)` | Transcreve áudio via Groq Whisper |

---

## Landing page (`src/app/page.tsx`)

- Seção **Hero** — tagline, mockup WhatsApp, CTA
- Seção **Features** — 3 cards (registrar gastos, consultar saldo, categorização automática)
- Seção **Integration** — sincronização em tempo real para o casal
- Seção **Pricing** — ⚠️ **OCULTA** com `{false && ...}` (R$ 29,99/mês — aguardando redesign)
- Seção **How it works** — 4 passos
- Seção **Testimonials** — ⚠️ **OCULTA** com `{false && ...}` (aguardando redesign)
- Seção **FAQ** — 3 perguntas
- Seção **CTA final**

---

## Variáveis de ambiente

```env
ANTHROPIC_API_KEY                  # Claude API
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY      # Público (frontend)
SUPABASE_SERVICE_ROLE_KEY          # Admin (server only)
ZAPI_TOKEN                         # Header de validação do webhook
ZAPI_INSTANCE_ID
ZAPI_CLIENT_TOKEN
NEXT_PUBLIC_FINN_NUMBER            # Número WhatsApp do Finn (ex: 5511939185732)
GROQ_API_KEY                       # Transcrição de áudio
```

---

## Estado atual (abril 2026)

### Funcionando
- Onboarding individual e casal end-to-end
- Registro de gastos/receitas por texto, imagem e áudio
- Edição de perfil via WhatsApp
- Modo grupo (casal compartilha grupo WhatsApp)
- Landing page + cadastro web + página de sucesso

### Recém corrigido
- Email do usuário não estava sendo enviado no payload do formulário de cadastro
- `chat_mode: 'individual'` não era salvo para usuários cadastrados via web

### Não existe ainda
- Dashboard web / relatórios visuais
- Notificações proativas (ex: "você gastou X% do orçamento")
- Cobrança / paywall (pricing está oculto na landing)
- Score financeiro (coluna `financial_score` existe mas não é calculada)

---

## Pegadinhas do código

- `employment_type` na tabela `users` está sendo **reaproveitado como `goal_category`** — não tem nada a ver com tipo de emprego
- No modo casal o onboarding é **assíncrono** — os dois parceiros passam pelos steps de forma independente; o código aguarda ambos terem apelido antes de pedir a meta
- `transactions` tem colunas duplicadas (`valor`/`amount`, `categoria`/`category`, `descricao`/`description`) — o webhook salva as duas por compatibilidade com o schema original
- O webhook sempre responde para `replyTo` (o chat — individual ou grupo), mas salva as mensagens com `userPhone` (o número individual da pessoa)
- Rate limit usa a tabela `messages` como fonte de verdade (conta msgs do último minuto)
