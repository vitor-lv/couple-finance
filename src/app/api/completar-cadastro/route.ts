import { NextRequest, NextResponse } from 'next/server'
import { supabase as adminSupabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { name, email, phone, partnerName, partnerPhone, partnerEmail, mode } = await request.json()

    if (!name?.trim() || !phone) {
      return NextResponse.json({ error: 'Nome e telefone são obrigatórios' }, { status: 400 })
    }

    if (mode === 'casal' && (!partnerName || !partnerPhone)) {
      return NextResponse.json({ error: 'Dados do parceiro(a) são obrigatórios' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\D/g, '')
    const userName = name.trim()

    // Verifica se já existe usuário com esse telefone ou email
    const { data: existing } = await adminSupabase
      .from('users')
      .select('id, phone')
      .or(`phone.eq.${cleanPhone}${email ? `,email.eq.${email}` : ''}`)
      .limit(1)

    if (existing?.length) {
      return NextResponse.json({ success: true, alreadyExists: true })
    }

    if (mode === 'individual') {
      // Cria só o usuário, sem casal
      const { error: userError } = await adminSupabase.from('users').insert({
        name: userName,
        email: email ?? null,
        phone: cleanPhone,
        chat_mode: 'individual',
        onboarding_completed: false,
        onboarding_step: -1,
      })

      if (userError) {
        console.error('completar-cadastro individual error:', userError.message)
        return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
      }

      return NextResponse.json({ success: true, mode: 'individual' })
    }

    // Modo casal
    const cleanPartnerPhone = partnerPhone.replace(/\D/g, '')

    const { data: couple, error: coupleError } = await adminSupabase
      .from('couples')
      .insert({ chat_mode: 'individual' })
      .select('id')
      .single()

    if (coupleError || !couple) {
      return NextResponse.json({ error: 'Erro ao criar casal' }, { status: 500 })
    }

    const { error: usersError } = await adminSupabase.from('users').insert([
      {
        name: userName,
        email: email ?? null,
        phone: cleanPhone,
        couple_id: couple.id,
        onboarding_completed: false,
        onboarding_step: -1,
      },
      {
        name: partnerName,
        email: partnerEmail || null,
        phone: cleanPartnerPhone,
        couple_id: couple.id,
        onboarding_completed: false,
        onboarding_step: -1,
      },
    ])

    if (usersError) {
      console.error('completar-cadastro casal error:', usersError.message)
      return NextResponse.json({ error: 'Erro ao criar usuários' }, { status: 500 })
    }

    return NextResponse.json({ success: true, mode: 'casal' })
  } catch (error) {
    console.error('completar-cadastro error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
