import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { supabase as adminSupabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user?.email) {
        const { data: existing } = await adminSupabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single()

        if (!existing) {
          await adminSupabase.from('users').insert({
            email: user.email,
            name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
            phone: null,
            onboarding_completed: false,
            onboarding_step: 0,
          })
        }
      }

      return NextResponse.redirect(`${origin}/sucesso`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`)
}
