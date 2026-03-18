import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { name, phone, partnerName, partnerPhone, email } = await request.json()

    if (!name || !phone || !partnerName || !partnerPhone || !email) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
    }

    // Cria o casal
    const { data: couple, error: coupleError } = await supabase
      .from('couples')
      .insert({})
      .select('id')
      .single()

    if (coupleError || !couple) {
      return NextResponse.json({ error: 'Erro ao criar casal' }, { status: 500 })
    }

    // Cria os 2 usuários
    const { error: usersError } = await supabase.from('users').insert([
      {
        name,
        phone,
        email,
        couple_id: couple.id,
        onboarding_completed: false,
        onboarding_step: 0,
      },
      {
        name: partnerName,
        phone: partnerPhone,
        couple_id: couple.id,
        onboarding_completed: false,
        onboarding_step: 0,
      },
    ])

    if (usersError) {
      return NextResponse.json({ error: 'Erro ao criar usuários' }, { status: 500 })
    }

    return NextResponse.json({ success: true, coupleId: couple.id })
  } catch (error) {
    console.error('Register error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
