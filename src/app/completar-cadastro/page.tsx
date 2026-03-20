'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { createClient } from '@/lib/supabase-browser'

export default function CompletarCadastro() {
  const router = useRouter()
  const [phone, setPhone] = useState<string>('')
  const [partnerName, setPartnerName] = useState('')
  const [partnerPhone, setPartnerPhone] = useState<string>('')
  const [chatMode, setChatMode] = useState<'individual' | 'group'>('individual')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsLoggedIn(!!session)
    }
    checkSession()
  }, [])

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/api/auth/callback' },
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!isValidPhoneNumber(phone || '')) {
      setError('Número de telefone inválido')
      return
    }
    if (!isValidPhoneNumber(partnerPhone || '')) {
      setError('Número do parceiro(a) inválido')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/completar-cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, partnerName, partnerPhone, chatMode }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao salvar cadastro')
        return
      }

      router.push(`/sucesso?partner=${encodeURIComponent(partnerName)}`)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Ainda verificando sessão
  if (isLoggedIn === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFDF9]">
        <div className="w-6 h-6 border-2 border-[#D85A30] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Não logado → mostra botão Google
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFDF9] px-4">
        <main className="flex flex-col items-center gap-8 w-full max-w-md text-center">
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-4xl font-bold tracking-tight text-[#1A1714]">
              finn<span className="text-[#D85A30]">.</span>
            </h1>
            <p className="text-[#1A1714] text-xl font-semibold mt-2">Quase lá!</p>
            <p className="text-[#8A8280] text-sm mt-1">Entre com Google para completar o cadastro</p>
          </div>
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="flex items-center gap-3 bg-white border border-[#E8E0D5] rounded-full px-6 py-3.5 text-[#1A1714] text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Redirecionando...' : 'Entrar com Google'}
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFFDF9] px-4">
      <main className="flex flex-col items-center gap-8 w-full max-w-md">

        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-[#1A1714]" style={{ fontFamily: 'Fraunces, serif' }}>
            finn<span className="text-[#D85A30]">.</span>
          </h1>
          <p className="text-[#1A1714] text-xl font-semibold mt-2" style={{ fontFamily: 'Fraunces, serif' }}>
            Quase lá!
          </p>
          <p className="text-[#8A8280] text-sm mt-1">
            Complete o cadastro para ativar o Finn
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">

          {/* Seu telefone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#8A8280] font-medium">seu WhatsApp</label>
            <div className="bg-white border border-[#E8E0D5] rounded-xl px-4 py-2.5 focus-within:border-[#D85A30] transition-colors">
              <PhoneInput
                international
                defaultCountry="BR"
                value={phone}
                onChange={(v) => setPhone(v ?? '')}
                className="phone-input"
              />
            </div>
          </div>

          <div className="h-px bg-[#E8E0D5]" />

          {/* Parceiro */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#8A8280] font-medium" htmlFor="partnerName">
              nome do parceiro(a)
            </label>
            <input
              id="partnerName"
              type="text"
              placeholder="Maria"
              value={partnerName}
              onChange={e => setPartnerName(e.target.value)}
              required
              className="bg-white border border-[#E8E0D5] rounded-xl px-4 py-3 text-sm text-[#1A1714] outline-none focus:border-[#D85A30] transition-colors placeholder:text-[#D0C8C0]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#8A8280] font-medium">
              WhatsApp do parceiro(a)
            </label>
            <div className="bg-white border border-[#E8E0D5] rounded-xl px-4 py-2.5 focus-within:border-[#D85A30] transition-colors">
              <PhoneInput
                international
                defaultCountry="BR"
                value={partnerPhone}
                onChange={(v) => setPartnerPhone(v ?? '')}
                className="phone-input"
              />
            </div>
          </div>

          {/* Modo de conversa */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-[#8A8280] font-medium">como vocês querem usar o Finn?</label>
            <div className="flex rounded-xl border border-[#E8E0D5] overflow-hidden">
              <button
                type="button"
                onClick={() => setChatMode('individual')}
                className={`flex-1 py-3 text-sm text-center transition-colors ${
                  chatMode === 'individual'
                    ? 'bg-[#D85A30] text-white font-medium'
                    : 'bg-white text-[#8A8280] hover:bg-[#FFF5F0]'
                }`}
              >
                👤 Individual
              </button>
              <button
                type="button"
                onClick={() => setChatMode('group')}
                className={`flex-1 py-3 text-sm text-center transition-colors ${
                  chatMode === 'group'
                    ? 'bg-[#D85A30] text-white font-medium'
                    : 'bg-white text-[#8A8280] hover:bg-[#FFF5F0]'
                }`}
              >
                👥 Grupo
              </button>
            </div>
            <p className="text-xs text-[#8A8280]">
              {chatMode === 'individual'
                ? 'Cada um conversa com o Finn separadamente'
                : 'Finn cria um grupo com vocês dois após o onboarding'}
            </p>
          </div>

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-[#D85A30] text-white rounded-full py-4 text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#C04E28] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            {loading ? 'Salvando...' : 'ativar o Finn →'}
          </button>
        </form>
      </main>

      <style jsx global>{`
        .phone-input {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .phone-input .PhoneInputCountry {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .phone-input .PhoneInputCountrySelect {
          background: transparent;
          border: none;
          outline: none;
          font-size: 13px;
          color: #8A8280;
          cursor: pointer;
        }
        .phone-input .PhoneInputInput {
          background: transparent;
          border: none;
          outline: none;
          font-size: 14px;
          color: #1A1714;
          width: 100%;
          font-family: 'DM Sans', sans-serif;
        }
        .phone-input .PhoneInputInput::placeholder {
          color: #D0C8C0;
        }
      `}</style>
    </div>
  )
}
