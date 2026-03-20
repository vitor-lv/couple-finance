'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

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
  const [loading, setLoading] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [authError, setAuthError] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'auth') {
      setAuthError(true)
    }
  }, [])

  const handleGoogleLogin = async () => {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/api/auth/callback' },
    })
  }

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
          onClick={handleGoogleLogin}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 disabled:opacity-60 cursor-pointer"
        >
          {loading ? 'Redirecionando...' : 'Começar grátis'}
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
              onClick={handleGoogleLogin}
              disabled={loading}
              className="inline-flex items-center gap-3 bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full text-base font-semibold transition-all duration-200 shadow-lg shadow-green-500/25 hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.121.555 4.109 1.524 5.835L.057 23.428a.5.5 0 0 0 .614.614l5.593-1.467A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.814 9.814 0 0 1-5.013-1.375l-.36-.214-3.714.975.993-3.63-.234-.373A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
              </svg>
              {loading ? 'Redirecionando...' : 'Quero organizar minhas finanças'}
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
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-full font-semibold text-base transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-green-500/20 disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Redirecionando...' : 'Assinar Agora'}
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
          onClick={handleGoogleLogin}
          disabled={loading}
          className="inline-flex items-center gap-3 bg-white text-green-600 font-bold px-10 py-4 rounded-full text-base hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 cursor-pointer"
        >
          <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {loading ? 'Redirecionando...' : 'Entrar com Google — é grátis'}
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
