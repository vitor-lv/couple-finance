'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

export default function CompletarCadastro() {
  const router = useRouter()
  const [phone, setPhone] = useState<string>('')
  const [partnerName, setPartnerName] = useState('')
  const [partnerPhone, setPartnerPhone] = useState<string>('')
  const [chatMode, setChatMode] = useState<'individual' | 'group'>('individual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
