-- Tabela de mensagens (histórico de conversas)
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  phone text not null,
  sender_name text,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  raw_message jsonb,
  created_at timestamp with time zone default now()
);

-- Tabela de transações financeiras
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  phone text not null,
  sender_name text,
  tipo text not null check (tipo in ('gasto', 'receita')),
  valor numeric(10, 2) not null,
  categoria text,
  descricao text,
  data date not null default current_date,
  created_at timestamp with time zone default now()
);

-- Índices para busca por telefone
create index if not exists messages_phone_idx on messages(phone);
create index if not exists messages_created_at_idx on messages(created_at desc);
create index if not exists transactions_phone_idx on transactions(phone);
create index if not exists transactions_data_idx on transactions(data desc);
