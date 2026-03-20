'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function SucessoContent() {
  const searchParams = useSearchParams()
  const partnerName = searchParams.get('partner')
  const finnNumber = process.env.NEXT_PUBLIC_FINN_NUMBER ?? '5511939185732'
  const whatsappUrl = `https://wa.me/${finnNumber}?text=Oi+Finn!+Acabei+de+me+cadastrar`

  return (
    <div className="min-h-screen bg-[#0D1117] flex flex-col">

      {/* Header */}
      <header className="px-6 py-5 border-b border-white/5 flex items-center gap-2">
        <span className="text-white text-xl font-bold tracking-tight">finn</span>
        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">AI</span>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <main className="flex flex-col items-center gap-8 text-center max-w-md w-full">

          {/* Ícone */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div className="absolute -inset-3 bg-green-500/5 rounded-full blur-xl -z-10" />
          </div>

          {/* Título */}
          <div className="flex flex-col gap-3">
            <h1 className="text-4xl font-bold text-white">
              Tudo pronto! 🎉
            </h1>
            {partnerName ? (
              <p className="text-gray-400 text-base leading-relaxed">
                Você e <span className="text-white font-semibold">{partnerName}</span> agora fazem parte do Finn.
                Comecem a conversar pelo WhatsApp.
              </p>
            ) : (
              <p className="text-gray-400 text-base leading-relaxed">
                Sua conta foi criada com sucesso. Agora é só começar a conversar com o Finn no WhatsApp.
              </p>
            )}
          </div>

          {/* CTA principal */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-green-500 hover:bg-green-600 text-white rounded-full px-8 py-4 text-base font-semibold shadow-lg shadow-green-500/20 hover:-translate-y-0.5 transition-all duration-200 w-full justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.121.555 4.109 1.524 5.835L.057 23.428a.5.5 0 0 0 .614.614l5.593-1.467A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.814 9.814 0 0 1-5.013-1.375l-.36-.214-3.714.975.993-3.63-.234-.373A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
            </svg>
            Falar com o Finn agora
          </a>

          {/* Info parceiro */}
          {partnerName && (
            <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-gray-400 leading-relaxed">
              Compartilhe o número do Finn com{' '}
              <span className="text-white font-medium">{partnerName}</span>{' '}
              para que ele(a) também possa registrar gastos juntos.
            </div>
          )}

          {/* Dicas */}
          <div className="flex flex-col gap-3 w-full">
            {[
              { cmd: '150 reais no mercado', desc: 'registrar um gasto' },
              { cmd: 'salário 5000', desc: 'registrar o salário' },
              { cmd: '? resumo', desc: 'ver resumo do mês' },
            ].map((tip, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <span className="text-xs text-gray-500">{tip.desc}</span>
                <code className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-lg font-mono">{tip.cmd}</code>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-600">
            Número do Finn: <span className="text-gray-400">+{finnNumber}</span>
          </p>
        </main>
      </div>
    </div>
  )
}

export default function Sucesso() {
  return (
    <Suspense>
      <SucessoContent />
    </Suspense>
  )
}
