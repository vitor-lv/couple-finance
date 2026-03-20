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
    if (!user?.email) return NextResponse.json({ ok: true }) // ignora se não tem sessão ainda

    // Cria registro temporário só se ainda não existir
    const { data: existing } = await adminSupabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .limit(1)

    if (!existing?.length) {
      const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email.split('@')[0]
      await adminSupabase.from('users').insert({
        email: user.email,
        name,
        phone: null,
        onboarding_completed: false,
        onboarding_step: 0,
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
