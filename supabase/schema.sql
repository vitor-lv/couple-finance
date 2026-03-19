-- ============================================================
-- COUPLE FINANCE — Schema consolidado
-- Gerado em: 2026-03-18
-- Banco: Supabase (PostgreSQL)
-- ============================================================
-- Para recriar o banco do zero, execute este arquivo completo
-- no SQL Editor do Supabase na ordem em que está escrito.
-- ============================================================


-- ============================================================
-- 1. COUPLES
-- Representa um casal cadastrado no Finn.
-- Criado quando o usuário completa o cadastro (web ou WhatsApp).
-- ============================================================
CREATE TABLE IF NOT EXISTS couples (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  chat_mode  text NOT NULL DEFAULT 'individual', -- 'individual' | 'group'
  group_id   text                                -- JID do grupo WhatsApp (Z-API), ex: "5511...@g.us"
);


-- ============================================================
-- 2. USERS
-- Um usuário por pessoa (não por conta Google).
-- Cada user pertence a um couple via couple_id.
-- O phone é nullable para permitir cadastro via Google OAuth
-- antes do número ser coletado.
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),

  -- Identidade
  email                text,
  name                 text,
  phone                text,                          -- Número sem formatação, ex: "5511999999999"
  nickname             text,                          -- Como quer ser chamado (step 0 do onboarding)

  -- Vínculo de casal
  couple_id            uuid REFERENCES couples (id),
  chat_mode            text NOT NULL DEFAULT 'individual', -- 'individual' | 'group'
  group_id             text,                          -- JID do grupo WhatsApp se chat_mode = 'group'

  -- Onboarding
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_step      integer NOT NULL DEFAULT 0,
  -- Steps:
  --  -1 = pergunta inicial (sozinho ou casal?) — usuários WhatsApp-first
  --  -2 = aguardando telefone do parceiro
  --   0 = nickname
  --   1 = renda mensal
  --   2 = dia do pagamento
  --   3 = bônus/13º
  --   4 = meta financeira (descrição)
  --   5 = meta financeira (valor)
  --   6 = concluído

  -- Estado de edição de perfil
  editing_field        text,                          -- Nome da coluna sendo editada, ex: 'monthly_income'

  -- Perfil financeiro (coletado no onboarding)
  monthly_income       numeric,                       -- Renda mensal em reais
  employment_type      text,                          -- Legado (não usado ativamente)
  has_bonus            boolean,                       -- Recebe bônus ou 13º anual
  payment_day          integer,                       -- Dia do mês que recebe (1-31)
  goal_description     text,                          -- Descrição da meta (ex: "reserva de emergência")
  goal_amount          numeric,                       -- Valor da meta em reais
  fixed_expenses       numeric                        -- Total de gastos fixos mensais
);


-- ============================================================
-- 3. MESSAGES
-- Histórico de mensagens trocadas com o Finn via WhatsApp.
-- Usada para contexto de conversa e rate limiting.
-- role: 'user' | 'assistant'
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  phone       text NOT NULL,                          -- Número do usuário (individual, mesmo em grupos)
  sender_name text,
  role        text NOT NULL,                          -- 'user' | 'assistant'
  content     text NOT NULL,
  raw_message jsonb                                   -- Payload bruto da Z-API (para debug)
);


-- ============================================================
-- 4. TRANSACTIONS
-- Gastos e receitas registrados via WhatsApp.
-- tipo: 'gasto' | 'receita'
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  phone       text NOT NULL,
  sender_name text,
  tipo        text NOT NULL,                          -- 'gasto' | 'receita'
  valor       numeric NOT NULL,
  categoria   text,                                   -- alimentação, transporte, moradia, saúde, lazer…
  descricao   text,
  data        text                                    -- Data da transação (ISO 8601, ex: "2026-03-18")
);


-- ============================================================
-- ROW LEVEL SECURITY
-- Todas as tabelas têm RLS habilitado.
-- Apenas o service_role (backend) tem acesso total.
-- O anon key (frontend) não tem acesso direto às tabelas.
-- ============================================================

ALTER TABLE couples      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Política: service_role tem acesso total (todas as operações)
CREATE POLICY "service_role full access" ON couples
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role full access" ON users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role full access" ON messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role full access" ON transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================
-- ÍNDICES (performance)
-- ============================================================

-- Busca de usuário por telefone (operação mais frequente no webhook)
CREATE INDEX IF NOT EXISTS idx_users_phone       ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_couple_id   ON users (couple_id);

-- Rate limiting e histórico de conversa
CREATE INDEX IF NOT EXISTS idx_messages_phone        ON messages (phone);
CREATE INDEX IF NOT EXISTS idx_messages_created_at   ON messages (created_at);

-- Consulta de transações por usuário
CREATE INDEX IF NOT EXISTS idx_transactions_phone      ON transactions (phone);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at);

-- Lookup de grupo
CREATE INDEX IF NOT EXISTS idx_couples_group_id ON couples (group_id);
CREATE INDEX IF NOT EXISTS idx_users_group_id   ON users (group_id);
