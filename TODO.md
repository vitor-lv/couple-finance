# TODO — Finn

## Prioridade Alta

- [ ] **Monitoramento de erros (Sentry)** — hoje você está cego em produção. Se o Claude retornar algo inesperado ou o webhook quebrar, você não sabe. Instalar o Sentry resolve em ~30 minutos.

- [ ] **Fuso horário no cálculo mensal** — o cálculo de "gastos do mês" usa o horário do servidor (pode não ser o fuso do usuário). Em virada de mês isso pode contar um gasto no mês errado. Arquivo: `src/lib/webhook/handlers.ts`

## Prioridade Média

- [ ] **Relatório mensal proativo** — o Finn manda automaticamente um resumo no primeiro dia de cada mês, sem o usuário precisar pedir. Precisaria de um cron job ou agendamento.

- [ ] **Histórico de transações via chat** — "mostra meus gastos de março" ainda não funciona direito. O Finn responde mas não puxa os dados reais do banco.

- [ ] **Financial score visível** — a coluna existe e é calculada, mas o usuário nunca vê de forma significativa. Poderia aparecer no resumo mensal ou no "ver perfil".

- [ ] **Testes do webhook** — zero testes hoje. Qualquer mudança no fluxo de gasto é um risco cego. Um teste básico do caminho principal (recebe mensagem → salva gasto → responde) já resolveria muito.

## Antes de lançar comercialmente

- [ ] **Pricing e testimonials** — as seções foram removidas da landing page. Precisam voltar (atualizadas) antes de começar a cobrar.

- [ ] **Paywall** — hoje qualquer pessoa que cadastra usa para sempre de graça. Definir e implementar o modelo de cobrança.

- [ ] **Alertas de orçamento** — avisar o usuário quando estiver perto de estourar o limite do mês.

## Dívida técnica (pode ir fazendo aos poucos)

- [ ] **`group_id` único em couples** — hoje dois casais poderiam ter o mesmo group_id por acidente, causando mensagens indo para o casal errado. Adicionar constraint única no banco.

- [ ] **Limpeza de rate limits antigos** — a tabela `webhook_rate_limits` cresce indefinidamente. Adicionar um job para deletar registros com mais de 1 dia.

- [ ] **Logs estruturados** — hoje os logs são `console.log` soltos. Dificulta debugar em produção. Substituir por logs com contexto (telefone, tipo de ação, etc).
