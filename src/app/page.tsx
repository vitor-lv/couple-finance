'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', partnerName: '', partnerPhone: '', email: '' })
  const [error, setError] = useState('')

  const handleGoogleLogin = async () => {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/api/auth/callback' },
    })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFormLoading(true)

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro ao cadastrar')
        return
      }

      const finnNumber = process.env.NEXT_PUBLIC_FINN_NUMBER ?? '5511939185732'
      window.location.href = `https://wa.me/${finnNumber}?text=Oi+Finn!+Acabei+de+me+cadastrar`
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFDF9] px-4">
      <main className="flex flex-col items-center gap-10 w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-4xl font-bold tracking-tight text-[#1A1714]">
            finn<span className="text-[#D85A30]">.</span>
          </h1>
          <p className="text-[#8A8280] text-base">assistente financeiro para casais</p>
        </div>

        {/* Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex items-center gap-3 bg-white border border-[#E8E0D5] rounded-full px-6 py-3.5 text-[#1A1714] text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {loading ? 'Redirecionando...' : 'Entrar com Google'}
        </button>

        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-[#E8E0D5]" />
          <span className="text-xs text-[#C0B8B0]">ou cadastre o casal</span>
          <div className="flex-1 h-px bg-[#E8E0D5]" />
        </div>

        {/* Form */}
        <form onSubmit={handleRegister} className="flex flex-col gap-4 w-full">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8A8280] font-medium" htmlFor="name">seu nome</label>
            <input
              id="name"
              type="text"
              placeholder="João"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              className="bg-white border border-[#E8E0D5] rounded-xl px-4 py-3 text-sm text-[#1A1714] outline-none focus:border-[#D85A30] transition-colors placeholder:text-[#D0C8C0]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8A8280] font-medium" htmlFor="phone">seu WhatsApp</label>
            <input
              id="phone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              required
              className="bg-white border border-[#E8E0D5] rounded-xl px-4 py-3 text-sm text-[#1A1714] outline-none focus:border-[#D85A30] transition-colors placeholder:text-[#D0C8C0]"
            />
          </div>

          <div className="h-px bg-[#E8E0D5]" />

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8A8280] font-medium" htmlFor="partnerName">nome do parceiro(a)</label>
            <input
              id="partnerName"
              type="text"
              placeholder="Maria"
              value={form.partnerName}
              onChange={e => setForm(f => ({ ...f, partnerName: e.target.value }))}
              required
              className="bg-white border border-[#E8E0D5] rounded-xl px-4 py-3 text-sm text-[#1A1714] outline-none focus:border-[#D85A30] transition-colors placeholder:text-[#D0C8C0]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8A8280] font-medium" htmlFor="partnerPhone">WhatsApp do parceiro(a)</label>
            <input
              id="partnerPhone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={form.partnerPhone}
              onChange={e => setForm(f => ({ ...f, partnerPhone: e.target.value }))}
              required
              className="bg-white border border-[#E8E0D5] rounded-xl px-4 py-3 text-sm text-[#1A1714] outline-none focus:border-[#D85A30] transition-colors placeholder:text-[#D0C8C0]"
            />
          </div>

          <div className="h-px bg-[#E8E0D5]" />

          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#8A8280] font-medium" htmlFor="email">email do casal</label>
            <input
              id="email"
              type="email"
              placeholder="voces@email.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              className="bg-white border border-[#E8E0D5] rounded-xl px-4 py-3 text-sm text-[#1A1714] outline-none focus:border-[#D85A30] transition-colors placeholder:text-[#D0C8C0]"
            />
          </div>

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={formLoading}
            className="bg-[#D85A30] text-white rounded-full py-4 text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#C04E28] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="9" fill="white" fillOpacity="0.25"/>
              <path d="M12.9 11.03c-.22-.11-1.32-.65-1.52-.72-.2-.08-.35-.11-.5.11-.15.22-.57.72-.7.87-.13.15-.26.17-.48.06-.22-.11-.93-.34-1.77-1.09-.65-.58-1.09-1.3-1.22-1.52-.13-.22 0-.34.1-.45l.34-.39c.11-.13.13-.22.2-.37.07-.15.02-.28-.04-.39-.06-.11-.5-1.21-.69-1.65-.18-.43-.37-.37-.5-.38l-.43-.01c-.15 0-.39.06-.6.28-.2.22-.78.76-.78 1.86 0 1.1.8 2.16.91 2.31.11.15 1.58 2.41 3.82 3.38.53.23.95.37 1.27.47.53.17 1.02.15 1.4.09.43-.07 1.32-.54 1.51-1.06.19-.52.19-.97.13-1.06-.06-.09-.2-.15-.42-.26z" fill="white"/>
            </svg>
            {formLoading ? 'Cadastrando...' : 'criar nossa conta grátis'}
          </button>

          <p className="text-xs text-[#C0B8B0] text-center">sem cartão de crédito</p>
        </form>
      </main>
    </div>
  )
}
