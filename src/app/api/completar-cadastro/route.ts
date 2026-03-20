import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { supabase as adminSupabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { name, phone, partnerName, partnerPhone, partnerEmail, mode } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 })
    }

    if (mode === 'casal' && (!partnerName || !partnerPhone)) {
      return NextResponse.json({ error: 'Dados do parceiro(a) são obrigatórios' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\D/g, '')
    const userName = name?.trim() ||
      (user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split('@')[0] ??
      'Usuário')

    // Remove registro temporário sem phone (criado no callback)
    await adminSupabase
      .from('users')
      .delete()
      .eq('email', user.email!)
      .is('phone', null)

    if (mode === 'individual') {
      // Cria só o usuário, sem casal
      const { error: userError } = await adminSupabase.from('users').insert({
        name: userName,
        email: user.email,
        phone: cleanPhone,
        onboarding_completed: false,
        onboarding_step: 0,
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
        email: user.email,
        phone: cleanPhone,
        couple_id: couple.id,
        onboarding_completed: false,
        onboarding_step: 0,
      },
      {
        name: partnerName,
        email: partnerEmail || null,
        phone: cleanPartnerPhone,
        couple_id: couple.id,
        onboarding_completed: false,
        onboarding_step: 0,
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
