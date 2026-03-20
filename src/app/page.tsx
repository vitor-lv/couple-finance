'use client'

import { useState, useEffect } from 'react'

const features = [
  {
    icon: '📝',
    title: 'Registrar gastos instantâneos',
    desc: '"Gastei 50 reais no almoço hoje". Pronto, seu registro está feito e categorizado automaticamente.',
  },
  {
    icon: '📊',
    title: 'Consultar saldos e limites',
    desc: 'Pergunte quanto ainda pode gastar no mês e receba um resumo inteligente do orçamento do casal.',
  },
  {
    icon: '🏷️',
    title: 'Categorização automática',
    desc: 'Nossa IA identifica o tipo de gasto e organiza tudo em relatórios para o casal.',
  },
]

const steps = [
  { num: '1', title: 'Crie sua conta', desc: 'Faça login com Google em segundos pelo nosso site' },
  { num: '2', title: 'Cadastre o casal', desc: 'Adicione você e seu parceiro(a) no Finn' },
  { num: '3', title: 'Salve o contato', desc: 'Salve o número do Finn no WhatsApp de vocês dois' },
  { num: '4', title: 'Comece a usar', desc: 'Registre gastos e consulte finanças pelo chat' },
]

const testimonials = [
  {
    stars: 5,
    text: '"Finalmente um jeito de controlar os gastos sem ter que abrir planilhas complexas. O chat mudou nossa vida a dois."',
    name: 'Ricardo S.',
    role: 'Empresário',
    initial: 'R',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    stars: 5,
    text: '"A integração é perfeita. Mando uma mensagem e já consigo ver tudo atualizado na hora. Meu marido adorou!"',
    name: 'Ana Paula L.',
    role: 'Designer',
    initial: 'A',
    color: 'bg-pink-100 text-pink-700',
  },
  {
    stars: 5,
    text: '"Simples, direto e funcional. O Finn é o melhor investimento que fizemos esse ano para nossas finanças."',
    name: 'Bruno M.',
    role: 'Desenvolvedor',
    initial: 'B',
    color: 'bg-green-100 text-green-700',
  },
]

const faqs = [
  {
    q: 'É seguro usar o Finn?',
    a: 'Sim! Seus dados são criptografados com padrão bancário e nunca são compartilhados com terceiros.',
  },
  {
    q: 'Quais WhatsApps são compatíveis?',
    a: 'Qualquer número de WhatsApp válido funciona com o Finn, tanto Android quanto iPhone.',
  },
  {
    q: 'Como funciona o cadastro do casal?',
    a: 'Você faz login com Google, cadastra seu telefone e o do parceiro(a). Os dois recebem acesso ao Finn automaticamente.',
  },
]

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [authError, setAuthError] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'auth') setAuthError(true)
  }, [])

  const goToCadastro = () => { window.location.href = '/completar-cadastro' }

  return (
    <div className="font-sans antialiased">

      {/* NAVBAR */}
      {authError && (
        <div className="bg-red-500 text-white text-sm text-center py-3 px-6">
          Erro ao fazer login. Tente novamente ou{' '}
          <button onClick={() => setAuthError(false)} className="underline cursor-pointer">fechar</button>.
        </div>
      )}

      <nav className="bg-[#0D1117] px-6 py-4 flex items-center justify-between sticky top-0 z-50 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-white text-xl font-bold tracking-tight">finn</span>
          <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">AI</span>
        </div>
        <button
          onClick={goToCadastro}
          className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer"
        >
          Começar grátis
        </button>
      </nav>

      {/* HERO */}
      <section className="bg-[#0D1117] px-6 pt-20 pb-28">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          {/* Text */}
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Assistente financeiro para casais
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-5">
              Chega de planilhas<br />
              <span className="text-green-400">chatas e complexas</span>
            </h1>
            <p className="text-gray-400 text-lg mb-10 max-w-md mx-auto lg:mx-0">
              Agora você e seu parceiro(a) têm o melhor assistente de finanças direto no WhatsApp.
            </p>
            <button
              onClick={goToCadastro}
              className="inline-flex items-center gap-3 bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full text-base font-semibold transition-all duration-200 shadow-lg shadow-green-500/25 hover:-translate-y-0.5 cursor-pointer"
            >
              💬 Quero organizar minhas finanças
            </button>
            <p className="text-gray-600 text-xs mt-4">Sem cartão de crédito • Login com Google</p>
          </div>

          {/* Phone mockup */}
          <div className="flex-1 flex justify-center lg:justify-end">
            <div className="relative">
              <div className="w-60 h-[480px] bg-[#111B21] rounded-[2.5rem] border-2 border-gray-700 flex flex-col overflow-hidden shadow-2xl shadow-black/50">
                {/* WhatsApp header */}
                <div className="bg-[#1F2C34] px-4 py-3 flex items-center gap-3 border-b border-white/5">
                  <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-sm font-bold text-white">F</div>
                  <div className="flex-1">
                    <div className="text-white text-sm font-semibold">Finn</div>
                    <div className="text-green-400 text-xs">online agora</div>
                  </div>
                </div>
                {/* Messages */}
                <div className="flex-1 p-3 flex flex-col gap-3 overflow-hidden bg-[#0B1419]">
                  <div className="bg-[#1F2C34] rounded-xl rounded-tl-sm p-2.5 text-xs text-gray-200 self-end max-w-[85%]">
                    g 50 almoço 🍱
                  </div>
                  <div className="bg-[#005C4B] rounded-xl rounded-tr-sm p-2.5 text-xs text-white self-start max-w-[85%]">
                    ✅ Gasto de <strong>R$50</strong> em Alimentação registrado!
                  </div>
                  <div className="bg-[#1F2C34] rounded-xl rounded-tl-sm p-2.5 text-xs text-gray-200 self-end max-w-[85%]">
                    ? resumo do mês
                  </div>
                  <div className="bg-[#005C4B] rounded-xl rounded-tr-sm p-2.5 text-xs text-white self-start max-w-[85%]">
                    📊 <strong>Resumo do casal</strong><br/>
                    Gastos: R$2.380<br/>
                    Receitas: R$8.500<br/>
                    Saldo: R$6.120 ✨
                  </div>
                  <div className="bg-[#1F2C34] rounded-xl rounded-tl-sm p-2.5 text-xs text-gray-200 self-end max-w-[85%]">
                    ? meta
                  </div>
                  <div className="bg-[#005C4B] rounded-xl rounded-tr-sm p-2.5 text-xs text-white self-start max-w-[85%]">
                    🎯 Viagem para Europa<br/>
                    R$4.200 / R$15.000<br/>
                    <span className="text-green-300">28% concluído</span>
                  </div>
                </div>
                {/* Input bar */}
                <div className="bg-[#1F2C34] px-3 py-2 flex items-center gap-2">
                  <div className="flex-1 bg-[#2A3942] rounded-full px-3 py-1.5 text-xs text-gray-400">
                    Mensagem
                  </div>
                  <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">➤</div>
                </div>
              </div>
              {/* Glow */}
              <div className="absolute -inset-4 bg-green-500/10 rounded-full blur-3xl -z-10" />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-white px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-bold text-center text-gray-900 mb-3">
            Basta enviar um texto{' '}
            <span className="relative inline-block">
              na conversa
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-green-500 rounded-full" />
            </span>{' '}
            e você poderá
          </h2>
          <p className="text-center text-gray-400 mt-4 mb-14 max-w-xl mx-auto">
            Sem apps extras, sem planilhas, sem complicação. Só o WhatsApp que você já usa.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="flex flex-col gap-4 p-7 rounded-2xl border border-gray-100 hover:border-green-200 hover:shadow-lg hover:shadow-green-500/5 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-2xl">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTEGRATION */}
      <section className="bg-gray-50 px-6 py-24">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          {/* Visual */}
          <div className="flex-1 flex justify-center">
            <div className="relative w-64 h-64 flex items-center justify-center">
              <div className="w-48 h-48 bg-green-500 rounded-full opacity-10 absolute animate-ping" style={{ animationDuration: '3s' }} />
              <div className="w-36 h-36 bg-green-500 rounded-full opacity-20 absolute" />
              <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center text-4xl relative z-10 shadow-xl shadow-green-500/30">
                💑
              </div>
            </div>
          </div>
          {/* Text */}
          <div className="flex-1">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-5 leading-tight">
              Sua conversa é sincronizada entre os dois em tempo real
            </h2>
            <p className="text-gray-500 mb-6 leading-relaxed">
              Todos os dados enviados via chat são instantaneamente compartilhados com seu parceiro(a). Tenha o poder da gestão financeira completa com a facilidade de um simples chat.
            </p>
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50 w-fit px-4 py-2 rounded-full">
              <span>🔒</span> Segurança de nível bancário e criptografia total
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="bg-white px-6 py-24">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
            Investimento na sua liberdade
          </h2>
          <p className="text-gray-400 mb-12">Um valor justo para organizar a vida financeira do casal.</p>
          <div className="border border-gray-200 rounded-3xl p-10 shadow-sm hover:shadow-xl transition-shadow duration-300">
            <div className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3">Plano Casal</div>
            <div className="text-2xl font-bold text-gray-900 mb-1">Finn PRO</div>
            <div className="flex items-end justify-center gap-1 mb-8">
              <span className="text-gray-400 text-sm mb-2">R$</span>
              <span className="text-5xl font-bold text-gray-900">29</span>
              <span className="text-gray-400 text-xl mb-1">,99</span>
              <span className="text-gray-400 text-sm mb-2">/mês</span>
            </div>
            <ul className="text-left flex flex-col gap-4 mb-10">
              {[
                '2 usuários incluídos (você + parceiro)',
                'Registro ilimitado de gastos',
                'Relatórios e metas do casal',
                'Suporte Premium 24/7',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-xs font-bold flex-shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={goToCadastro}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-full font-semibold text-base transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-green-500/20 cursor-pointer"
            >
              Assinar Agora
            </button>
            <p className="text-gray-400 text-xs mt-4">7 dias grátis • Cancele quando quiser</p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-[#0D1117] px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-bold text-white text-center mb-4">Veja como é simples</h2>
          <p className="text-gray-500 text-center mb-16 max-w-md mx-auto">Do cadastro ao primeiro gasto registrado em menos de 2 minutos.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-green-500/30">
                  {s.num}
                </div>
                <div className="font-semibold text-white">{s.title}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-white px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-bold text-center text-gray-900 mb-14">
            O que dizem nossos usuários
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="border border-gray-100 rounded-2xl p-7 flex flex-col gap-4 hover:shadow-lg transition-shadow duration-300"
              >
                <div className="text-yellow-400 text-base tracking-wide">
                  {'★'.repeat(t.stars)}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed flex-1">{t.text}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${t.color}`}>
                    {t.initial}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 px-6 py-24">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-bold text-center text-gray-900 mb-12">
            Perguntas Frequentes
          </h2>
          <div className="flex flex-col gap-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left font-medium text-gray-900 hover:text-green-600 transition-colors cursor-pointer"
                >
                  {faq.q}
                  <span className={`text-gray-400 text-xl transition-transform duration-200 ${openFaq === i ? 'rotate-45' : ''}`}>
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-green-500 px-6 py-20 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
          Prontos para organizar as finanças juntos?
        </h2>
        <p className="text-green-100 mb-10 max-w-md mx-auto">
          Comece gratuitamente hoje e transforme o WhatsApp de vocês numa ferramenta financeira poderosa.
        </p>
        <button
          onClick={goToCadastro}
          className="inline-flex items-center gap-3 bg-white text-green-600 font-bold px-10 py-4 rounded-full text-base hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        >
          Criar conta grátis
        </button>
      </section>


      {/* FOOTER */}
      <footer className="bg-[#0D1117] px-6 py-10 text-center border-t border-white/5">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-white text-lg font-bold">finn</span>
          <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">AI</span>
        </div>
        <p className="text-gray-600 text-sm">© 2025 Finn. Assistente financeiro para casais.</p>
      </footer>
    </div>
  )
}
