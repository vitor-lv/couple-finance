import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabase as adminSupabase } from '@/lib/supabase'

export async function POST() {
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

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log('[save-user] user:', user?.email ?? null, 'error:', userError?.message ?? null)

  if (!user?.email) {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }

  const { data: existing, error: selectError } = await adminSupabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .single()

  console.log('[save-user] existing:', existing?.id ?? null, 'selectError:', selectError?.code ?? null)

  if (!existing) {
    const { error: insertError } = await adminSupabase.from('users').insert({
      email: user.email,
      name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      phone: null,
      onboarding_completed: false,
      onboarding_step: 0,
    })
    console.log('[save-user] insert:', insertError?.message ?? 'ok')

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, email: user.email })
}
