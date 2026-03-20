'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

export default function CompletarCadastro() {
  const router = useRouter()
  const [mode, setMode] = useState<'individual' | 'casal'>('individual')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState<string>('')
  const [partnerName, setPartnerName] = useState('')
  const [partnerPhone, setPartnerPhone] = useState<string>('')
  const [partnerEmail, setPartnerEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  return (
    <div className="min-h-screen bg-[#0D1117] flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 border-b border-white/5 flex items-center gap-2">
        <span className="text-white text-xl font-bold tracking-tight">finn</span>
        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">AI</span>
      </header>

      <div className="flex-1 flex flex-col items-center px-4 py-10">
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

          </div>{/* fecha max-w-md */}

          <form onSubmit={handleSubmit} className="flex flex-col items-center gap-5 w-full">

            {/* Boxes — expandem no casal */}
            <div className={mode === 'casal' ? 'grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl' : 'flex flex-col gap-5 w-full max-w-md'}>

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
                  <label className="text-xs text-gray-400">e-mail <span className="text-gray-600">(opcional)</span></label>
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={partnerEmail}
                    onChange={e => setPartnerEmail(e.target.value)}
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

              </div>
            )}

            </div>{/* fim grid */}

            {/* Erro e botão — sempre max-w-md */}
            <div className="w-full max-w-md flex flex-col gap-4">
              {error && (
                <p className="text-xs text-red-400 text-center bg-red-500/10 py-3 px-4 rounded-xl border border-red-500/20">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-500 hover:bg-green-600 text-white rounded-full py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-green-500/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Salvando...' : 'Ativar o Finn →'}
              </button>

              <p className="text-xs text-gray-600 text-center">
                Seus dados são protegidos com criptografia de nível bancário 🔒
              </p>
            </div>
          </form>
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
