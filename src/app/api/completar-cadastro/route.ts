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

    const { phone, partnerName, partnerPhone, chatMode } = await request.json()

    if (!phone || !partnerName || !partnerPhone) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
    }

    // Remove tudo que não for número
    const cleanPhone = phone.replace(/\D/g, '')
    const cleanPartnerPhone = partnerPhone.replace(/\D/g, '')

    // Cria o casal
    const { data: couple, error: coupleError } = await adminSupabase
      .from('couples')
      .insert({ chat_mode: chatMode === 'group' ? 'group' : 'individual' })
      .select('id')
      .single()

    if (coupleError || !couple) {
      return NextResponse.json({ error: 'Erro ao criar casal' }, { status: 500 })
    }

    // Deleta registro anterior sem phone (criado no /sucesso)
    await adminSupabase
      .from('users')
      .delete()
      .eq('email', user.email!)
      .is('phone', null)

    // Fallback para name: Google metadata → parte do email
    const userName =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split('@')[0] ??
      'Usuário'

    // Cria os 2 usuários
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
        phone: cleanPartnerPhone,
        couple_id: couple.id,
        onboarding_completed: false,
        onboarding_step: 0,
      },
    ])

    if (usersError) {
      console.error('completar-cadastro usersError:', usersError.message)
      return NextResponse.json({ error: 'Erro ao criar usuários' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('completar-cadastro error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
