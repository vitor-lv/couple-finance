# Guia do Finn — O que cada arquivo faz

Este guia explica o projeto em linguagem simples, sem termos técnicos.
Use ele para saber onde mexer quando quiser mudar alguma coisa.

---

## Como o Finn funciona (visão geral)

1. O usuário manda uma mensagem no WhatsApp
2. A Z-API (serviço que conecta ao WhatsApp) repassa essa mensagem para o Finn
3. O Finn entende o que o usuário quis dizer (usando o Claude AI)
4. O Finn salva as informações no banco de dados (Supabase)
5. O Finn responde de volta para o usuário no WhatsApp

---

## As pastas principais

```
src/app/          → Páginas do site e rotas do servidor
src/lib/          → Cérebro do sistema (regras, integrações, lógica)
supabase/         → Banco de dados
public/           → Imagens e arquivos estáticos do site
```

---

## Páginas do site (`src/app/`)

### `src/app/page.tsx`
**É a landing page** — a página que as pessoas veem quando acessam o site do Finn.
Tem: título, explicação do produto, como funciona, perguntas frequentes e botão de cadastro.

> Quer mudar o texto do título? Vai nesse arquivo.
> Quer mudar o botão de cadastro? Vai nesse arquivo.

---

### `src/app/completar-cadastro/page.tsx`
**É o formulário de cadastro** — a página onde o usuário coloca o nome, telefone e dados do parceiro após fazer login com Google.

> Quer mudar os campos do formulário? Vai nesse arquivo.
> Quer mudar o texto de instrução do cadastro? Vai nesse arquivo.

---

### `src/app/sucesso/page.tsx`
**É a página de confirmação** — aparece depois que o cadastro é concluído com sucesso.
Mostra uma mensagem de boas-vindas e instrui o usuário a salvar o contato do Finn no WhatsApp.

> Quer mudar a mensagem de sucesso? Vai nesse arquivo.

---

### `src/app/layout.tsx`
**É o "esqueleto" de todas as páginas** — define o título que aparece na aba do navegador, o idioma e a fonte.

> Quer mudar o título da aba do navegador? Vai nesse arquivo.

---

## Rotas do servidor (`src/app/api/`)

Essas são as "portas dos fundos" do sistema — o usuário nunca vê, mas é por aqui que os dados chegam e saem.

### `src/app/api/webhook/route.ts`
**É a porta de entrada de todas as mensagens do WhatsApp.**
Quando alguém manda uma mensagem pro Finn, ela chega aqui primeiro.
Esse arquivo decide o que fazer: é uma mensagem nova? É um áudio? É uma imagem? É alguém no onboarding?

> Não mexa aqui sem necessidade — é o arquivo mais crítico do sistema.

---

### `src/app/api/completar-cadastro/route.ts`
**Salva o cadastro do usuário no banco de dados** quando ele preenche o formulário no site.

---

### `src/app/api/auth/callback/route.ts`
**Processa o login com Google.** Quando o usuário clica em "Entrar com Google" e autoriza, ele passa por aqui. O Finn verifica se já tem conta e redireciona para o lugar certo.

---

### `src/app/api/auth/email-signup/route.ts`
**Cria o registro inicial** quando alguém se cadastra por email. Guarda os dados básicos enquanto o cadastro completo não foi feito.

---

## O cérebro do sistema (`src/lib/`)

### `src/lib/claude.ts`
**É toda a integração com o Claude AI.**
Aqui estão as instruções que o Finn segue para entender as mensagens dos usuários:
- Como interpretar "gastei 50 no mercado" → gasto de R$50 em alimentação
- Como entender o nome que o usuário quer usar
- Como analisar uma foto de nota fiscal
- Como transcrever um áudio

> Quer mudar a personalidade do Finn? Quer que ele responda diferente? Vai nesse arquivo.
> Quer mudar as categorias de gasto? Vai nesse arquivo.

---

### `src/lib/onboarding.ts`
**Controla o processo de boas-vindas** — as perguntas que o Finn faz quando um usuário novo começa a usar.
Também controla a edição de perfil (quando o usuário quer mudar a renda, meta, etc).

O processo de boas-vindas tem 5 etapas:
1. Pede o apelido
2. Pede a meta financeira (viagem, reserva, casa própria...)
3. Pede o valor (da renda ou da meta)
4. Confirma o valor sugerido (se for reserva de emergência)
5. Pede quanto quer guardar por mês

> Quer mudar as perguntas do onboarding? Vai nesse arquivo.
> Quer mudar os campos que aparecem no "ver perfil"? Vai nesse arquivo.
> Quer adicionar um novo campo editável? Vai nesse arquivo.

---

### `src/lib/webhook/handlers.ts`
**Contém as 4 ações principais que o Finn pode tomar** quando recebe uma mensagem:
- `handleNewUser` — o que fazer quando alguém manda mensagem pela primeira vez
- `handleEditing` — o que fazer quando o usuário está editando o perfil
- `handleOnboarding` — o que fazer durante o processo de boas-vindas
- `handleFinance` — o que fazer com mensagens normais (gastos, consultas, etc)

---

### `src/lib/webhook/messages.ts`
**Cuida de salvar e enviar mensagens.**
Toda vez que o Finn precisa salvar uma mensagem no banco e responder ao usuário, passa por aqui.

---

### `src/lib/zapi.ts`
**É a integração com o WhatsApp** (via Z-API).
Tem duas funções principais:
- `sendTextMessage` — envia uma mensagem de texto
- `sendTyping` — faz aparecer o "digitando..." antes de responder

> Quer mudar algum comportamento de envio de mensagem? Vai nesse arquivo.

---

### `src/lib/supabase.ts`
**É a conexão com o banco de dados** (Supabase).
Usado internamente pelo sistema — raramente precisa ser modificado.

---

### `src/lib/auth-server.ts`
**Cuida do login** — verifica se o usuário está autenticado nas páginas que precisam de login.

---

### `src/lib/url-validation.ts`
**Segurança** — impede que o Finn acesse URLs suspeitas (redes internas, localhost, etc).

---

### `src/lib/constants.ts`
**Lista de tipos de ação** que o Finn reconhece: gasto, receita, ver perfil, editar perfil, etc.

> Se um dia precisar adicionar um novo tipo de ação, começa aqui.

---

## Banco de dados (`supabase/`)

### `supabase/schema.sql`
**É o "plano" do banco de dados** — descreve todas as tabelas e colunas que existem.
Se precisar recriar o banco do zero, roda esse arquivo no Supabase.

### `supabase/migrations/`
**São as mudanças feitas no banco ao longo do tempo.**
Cada arquivo é uma alteração — adicionar coluna, renomear campo, criar índice.
Para aplicar uma migration, roda o arquivo no SQL Editor do Supabase.

---

## Referência rápida — "Quero mudar..."

| O que quero mudar | Onde mexer |
|---|---|
| Texto da landing page | `src/app/page.tsx` |
| Título na aba do navegador | `src/app/layout.tsx` |
| Formulário de cadastro | `src/app/completar-cadastro/page.tsx` |
| Página de sucesso pós-cadastro | `src/app/sucesso/page.tsx` |
| Como o Finn responde as mensagens | `src/lib/claude.ts` |
| Personalidade / tom do Finn | `src/lib/claude.ts` |
| Categorias de gasto | `src/lib/claude.ts` |
| Perguntas do onboarding | `src/lib/onboarding.ts` |
| Campos editáveis do perfil | `src/lib/onboarding.ts` |
| O que aparece no "ver meu perfil" | `src/lib/onboarding.ts` |
| Lógica de quando responder o quê | `src/lib/webhook/handlers.ts` |
