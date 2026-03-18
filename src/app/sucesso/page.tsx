'use client'

import { useEffect } from 'react'

export default function Sucesso() {
  const finnNumber = process.env.NEXT_PUBLIC_FINN_NUMBER ?? '5511939185732'
  const whatsappUrl = `https://wa.me/${finnNumber}?text=Oi+Finn!+Acabei+de+me+cadastrar`

  useEffect(() => {
    fetch('/api/save-user', { method: 'POST' })
      .then(r => r.json())
      .then(d => console.log('[sucesso] save-user:', d))
      .catch(e => console.error('[sucesso] save-user error:', e))
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFDF9]">
      <main className="flex flex-col items-center gap-8 text-center px-6 max-w-sm">
        <div className="w-16 h-16 rounded-full bg-[#E1F5EE] flex items-center justify-center text-3xl">
          🐟
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1714]">
            Bem-vindos ao Finn!
          </h1>
          <p className="text-[#8A8280] text-base leading-relaxed">
            Sua conta foi criada. Agora é só começar a conversar com o Finn no WhatsApp.
          </p>
        </div>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-[#25D366] text-white rounded-full px-8 py-4 text-base font-medium shadow-md hover:bg-[#20B858] hover:-translate-y-0.5 transition-all duration-200"
        >
          <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="9" fill="white" fillOpacity="0.25"/>
            <path d="M12.9 11.03c-.22-.11-1.32-.65-1.52-.72-.2-.08-.35-.11-.5.11-.15.22-.57.72-.7.87-.13.15-.26.17-.48.06-.22-.11-.93-.34-1.77-1.09-.65-.58-1.09-1.3-1.22-1.52-.13-.22 0-.34.1-.45l.34-.39c.11-.13.13-.22.2-.37.07-.15.02-.28-.04-.39-.06-.11-.5-1.21-.69-1.65-.18-.43-.37-.37-.5-.38l-.43-.01c-.15 0-.39.06-.6.28-.2.22-.78.76-.78 1.86 0 1.1.8 2.16.91 2.31.11.15 1.58 2.41 3.82 3.38.53.23.95.37 1.27.47.53.17 1.02.15 1.4.09.43-.07 1.32-.54 1.51-1.06.19-.52.19-.97.13-1.06-.06-.09-.2-.15-.42-.26z" fill="white"/>
          </svg>
          Falar com o Finn
        </a>

        <p className="text-xs text-[#C0B8B0]">
          Dica: mande <strong className="text-[#8A8280]">g 50 mercado</strong> para registrar seu primeiro gasto
        </p>
      </main>
    </div>
  )
}
