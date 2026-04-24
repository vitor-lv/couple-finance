import { NextRequest, NextResponse } from 'next/server'
import { supabase as adminSupabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/auth-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { name, phone, partnerName, partnerPhone, email } = await request.json()

    if (!name || !phone || !partnerName || !partnerPhone || !email) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
    }

    if (email !== user.email) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 403 })
    }

    const { data: couple, error: coupleError } = await adminSupabase
      .from('couples')
      .insert({})
      .select('id')
      .single()

    if (coupleError || !couple) {
      return NextResponse.json({ error: 'Erro ao criar casal' }, { status: 500 })
    }

    const { error: usersError } = await adminSupabase.from('users').insert([
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
      console.error('Register usersError:', usersError.message)
      return NextResponse.json({ error: 'Erro ao criar usuários' }, { status: 500 })
    }

    return NextResponse.json({ success: true, coupleId: couple.id })
  } catch (error) {
    console.error('Register error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
