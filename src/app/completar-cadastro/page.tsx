'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { createClient } from '@/lib/supabase-browser'

export default function CompletarCadastro() {
  const router = useRouter()
  const [mode, setMode] = useState<'individual' | 'casal'>('individual')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState<string>('')
  const [partnerName, setPartnerName] = useState('')
  const [partnerPhone, setPartnerPhone] = useState<string>('')
  const [partnerEmail, setPartnerEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsLoggedIn(!!session)
      if (session?.user) {
        setUserEmail(session.user.email ?? '')
        setEmail(session.user.email ?? '')
        const googleName =
          session.user.user_metadata?.full_name ??
          session.user.user_metadata?.name ?? ''
        setName(googleName)
      }
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

    if (mode === 'casal') {
      if (!partnerName.trim()) {
        setError('Nome do parceiro(a) é obrigatório')
        return
      }
      if (!isValidPhoneNumber(partnerPhone || '')) {
        setError('Número do parceiro(a) inválido')
        return
      }
    }

    setLoading(true)
    try {
      const res = await fetch('/api/completar-cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, partnerName, partnerPhone, partnerEmail, mode }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao salvar cadastro')
        return
      }

      if (mode === 'individual') {
        router.push('/sucesso')
      } else {
        router.push(`/sucesso?partner=${encodeURIComponent(partnerName)}`)
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Carregando sessão
  if (isLoggedIn === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D1117]">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Não logado
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex flex-col">
        <header className="px-6 py-5 border-b border-white/5 flex items-center gap-2">
          <span className="text-white text-xl font-bold tracking-tight">finn</span>
          <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">AI</span>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="flex flex-col items-center gap-8 w-full max-w-sm text-center">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Boas-vindas!</h1>
              <p className="text-gray-400">Entre com Google para completar seu cadastro</p>
            </div>
            <button
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="flex items-center gap-3 bg-white text-gray-800 px-6 py-3.5 rounded-full text-sm font-medium shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer disabled:opacity-60 w-full justify-center"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {googleLoading ? 'Redirecionando...' : 'Entrar com Google'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0D1117] flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 border-b border-white/5 flex items-center gap-2">
        <span className="text-white text-xl font-bold tracking-tight">finn</span>
        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">AI</span>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">

          {/* Título */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Boas-vindas!</h1>
            <p className="text-gray-400">Complete seu cadastro para ativar o Finn</p>
          </div>

          {/* Seletor de modo */}
          <div className="mb-8">
            <p className="text-sm text-gray-400 mb-3">Como você quer usar o Finn?</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode('individual')}
                className={`flex-1 py-3.5 px-4 rounded-xl text-sm font-medium border transition-all duration-200 cursor-pointer ${
                  mode === 'individual'
                    ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/20'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                👤 Individual
              </button>
              <button
                type="button"
                onClick={() => setMode('casal')}
                className={`flex-1 py-3.5 px-4 rounded-xl text-sm font-medium border transition-all duration-200 cursor-pointer ${
                  mode === 'casal'
                    ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/20'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                💑 Casal
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {mode === 'individual'
                ? 'Você usa o Finn sozinho para controlar suas finanças'
                : 'Você e seu parceiro(a) usam o Finn juntos'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Boxes lado a lado no modo casal */}
            <div className={mode === 'casal' ? 'grid grid-cols-2 gap-4' : 'flex flex-col gap-5'}>

            {/* Dados do usuário */}
            <div className="flex flex-col gap-4 p-5 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">Seus dados</p>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">nome</label>
                <input
                  type="text"
                  placeholder="Como você quer ser chamado?"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-green-500 transition-colors placeholder:text-gray-600"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">e-mail</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-green-500 transition-colors placeholder:text-gray-600"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">seu WhatsApp</label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-green-500 transition-colors">
                  <PhoneInput
                    international
                    defaultCountry="BR"
                    value={phone}
                    onChange={(v) => setPhone(v ?? '')}
                    className="phone-input"
                  />
                </div>
              </div>

            </div>

            {/* Dados do parceiro — só no modo casal */}
            {mode === 'casal' && (
              <div className="flex flex-col gap-4 p-5 bg-white/5 rounded-2xl border border-white/10 border-green-500/20">
                <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">Dados do parceiro(a)</p>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-400">nome</label>
                  <input
                    type="text"
                    placeholder="Nome do parceiro(a)"
                    value={partnerName}
                    onChange={e => setPartnerName(e.target.value)}
                    required={mode === 'casal'}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-green-500 transition-colors placeholder:text-gray-600"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-400">WhatsApp</label>
                  <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-green-500 transition-colors">
                    <PhoneInput
                      international
                      defaultCountry="BR"
                      value={partnerPhone}
                      onChange={(v) => setPartnerPhone(v ?? '')}
                      className="phone-input"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-400">e-mail <span className="text-gray-600">(opcional)</span></label>
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={partnerEmail}
                    onChange={e => setPartnerEmail(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-green-500 transition-colors placeholder:text-gray-600"
                  />
                </div>
              </div>
            )}

            </div>{/* fim grid */}

            {error && (
              <p className="text-xs text-red-400 text-center bg-red-500/10 py-3 px-4 rounded-xl border border-red-500/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-green-500 hover:bg-green-600 text-white rounded-full py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-green-500/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Ativar o Finn →'}
            </button>

            <p className="text-xs text-gray-600 text-center">
              Seus dados são protegidos com criptografia de nível bancário 🔒
            </p>
          </form>
        </div>
      </div>

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
          color: #9CA3AF;
          cursor: pointer;
        }
        .phone-input .PhoneInputInput {
          background: transparent;
          border: none;
          outline: none;
          font-size: 14px;
          color: white;
          width: 100%;
        }
        .phone-input .PhoneInputInput::placeholder {
          color: #4B5563;
        }
      `}</style>
    </div>
  )
}
