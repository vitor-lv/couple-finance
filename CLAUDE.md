# Finn — Assistente financeiro para casais via WhatsApp

Next.js 15 (App Router) + Supabase (PostgreSQL) + Claude Haiku + Z-API + Vercel.  
Usuários mandam mensagens em linguagem natural no WhatsApp; o Finn interpreta, salva e responde.  
Não há dashboard — a UX é 100% conversacional.

---

## Arquivos e responsabilidades

### Webhook (coração do sistema)
| Arquivo | O que faz |
|---|---|
| `src/app/api/webhook/route.ts` | Recebe POST da Z-API. Valida token/HMAC/rate limit, roteia para o handler certo. ~130 linhas. |
| `src/lib/webhook/handlers.ts` | 4 handlers: `handleNewUser`, `handleEditing`, `handleOnboarding`, `handleFinance`. |
| `src/lib/webhook/messages.ts` | Utilitários de persistência: `insertUserMessage`, `insertAssistantMessage`, `saveAndSend`, `saveAndReply`. |

### Lógica de negócio
| Arquivo | O que faz |
|---|---|
| `src/lib/onboarding.ts` | Steps 0–4 do onboarding + edição de perfil + `formatUserProfile` + `calculateFinancialScore`. Exporta `User` type. |
| `src/lib/claude.ts` | Todas as chamadas à API Claude/Groq: `processFinanceMessage`, `processFinanceImage`, `transcribeAudio`, `interpretNickname`, `interpretGoal`, `interpretMoneyValue`, `interpretEditValue`. |
| `src/lib/constants.ts` | `TIPO` — enum de tipos de resposta (`gasto`, `receita`, `ver_perfil`, etc). |
| `src/lib/url-validation.ts` | `isAllowedExternalUrl` — bloqueia URLs privadas/internas. |

### Infra / Auth
| Arquivo | O que faz |
|---|---|
| `src/lib/supabase.ts` | Client admin (service_role) — usado no server. |
| `src/lib/auth-server.ts` | `createSupabaseServerClient()` — client com cookies para rotas autenticadas. |
| `src/lib/zapi.ts` | `sendTextMessage`, `sendTyping` — integração Z-API. |

### API routes (cadastro web)
| Rota | O que faz |
|---|---|
| `src/app/api/auth/callback/route.ts` | Callback OAuth Google → cria user se não existe, redireciona. |
| `src/app/api/auth/check-user/route.ts` | Verifica se usuário autenticado já tem telefone cadastrado. |
| `src/app/api/auth/email-signup/route.ts` | Pós-signup email: cria registro temporário no banco. |
| `src/app/api/completar-cadastro/route.ts` | Cria usuário (individual) ou casal + 2 usuários (modo casal). |
| `src/app/api/register/route.ts` | Rota legada de registro com auth — cria casal para usuário autenticado. |
| `src/app/api/save-user/route.ts` | Salva usuário OAuth se ainda não existe no banco. |

### Frontend
| Arquivo | O que faz |
|---|---|
| `src/app/page.tsx` | Landing page — hero, features, como funciona, FAQ, CTA. |
| `src/app/completar-cadastro/page.tsx` | Formulário pós-login: coleta telefone e dados do parceiro. |
| `src/app/sucesso/page.tsx` | Confirmação pós-cadastro com instruções de uso. |

### Schema
| Arquivo | O que faz |
|---|---|
| `supabase/schema.sql` | Schema canônico completo. Rodar do zero recria tudo. |
| `supabase/migrations/` | Migrations incrementais. Rodar em ordem no SQL Editor do Supabase. |

---

## Fluxo do webhook (ordem de prioridade)

```
POST /api/webhook
  1. Validação: token Z-API → HMAC → parse JSON → fromMe? → rate limit
  2. Mídia: imagem → processFinanceImage | áudio → transcribeAudio → texto
  3. Busca user por phone. Se não existe → handleNewUser
  4. user.editing_field?        → handleEditing
  5. onboarding_completed=false? → handleOnboarding
  6. else                        → handleFinance
```

---

## Banco de dados (tabelas principais)

**users** — uma linha por pessoa  
`phone` · `nickname` · `couple_id` · `chat_mode` · `onboarding_step` · `onboarding_completed` · `editing_field` · `monthly_income` · `monthly_savings_goal` · `fixed_expenses` · `goal_category` · `goal_description` · `goal_amount` · `financial_score`

**transactions**  
`phone` · `tipo` (gasto/receita) · `valor` · `categoria` · `descricao` · `data` · `couple_id`

**messages** — histórico de conversa + idempotência  
`phone` · `role` (user/assistant) · `content` · `raw_message` (JSONB com `keyId` para deduplicação)

**couples** — vínculo de casal  
`id` · `group_id` (JID do grupo WhatsApp) · `chat_mode`

---

## Onboarding steps

| Step | O que acontece |
|---|---|
| -1 | Primeira mensagem → envia boas-vindas, avança para 0 |
| 0 | Pede apelido → `interpretNickname` |
| 1 | Pede meta financeira → `interpretGoal` (salva em `goal_category` + `goal_description`) |
| 2 | Pede valor — renda (se `reserva_emergencia`) ou valor da meta |
| 3 | Confirma valor sugerido (só `reserva_emergencia`) |
| 4 | Pede poupança mensal → `onboarding_completed = true` |

---

## Convenções

- Todo acesso ao banco é via `service_role` (nunca anon key no server)
- Rotas autenticadas usam `createSupabaseServerClient()` de `src/lib/auth-server.ts`
- Tipos de resposta do Claude ficam em `TIPO` (`src/lib/constants.ts`)
- RLS habilitado em todas as tabelas — só `service_role` tem acesso
- Grupos WhatsApp: `replyTo = body.phone` (JID do grupo), `userPhone = participantPhone`
