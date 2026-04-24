import { NextResponse } from 'next/server'
import { supabase as adminSupabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/auth-server'

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ ok: true }) // no session yet, ignore silently

    const { data: existing } = await adminSupabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .limit(1)

    if (!existing?.length) {
      const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email.split('@')[0]
      const { error: insertError } = await adminSupabase.from('users').insert({
        email: user.email,
        name,
        phone: null,
        onboarding_completed: false,
        onboarding_step: 0,
      })

      if (insertError) {
        console.error('email-signup insert error:', insertError.message)
        return NextResponse.json({ ok: false, error: 'Erro ao criar usuário' }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('email-signup error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ ok: false, error: 'Erro interno' }, { status: 500 })
  }
}
