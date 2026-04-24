import { NextRequest, NextResponse } from 'next/server'
import { supabase as adminSupabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/auth-server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user?.email) {
        const { data: existingRows } = await adminSupabase
          .from('users')
          .select('id, phone')
          .eq('email', user.email)
          .limit(1)

        const existing = existingRows?.[0] ?? null

        if (!existing) {
          const name =
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            user.email.split('@')[0]

          const { error: insertError } = await adminSupabase.from('users').insert({
            email: user.email,
            name,
            phone: null,
            onboarding_completed: false,
            onboarding_step: 0,
          })

          if (insertError) {
            console.error('callback insert error:', insertError.message)
            return NextResponse.redirect(`${origin}/?error=auth`)
          }

          return NextResponse.redirect(`${origin}/completar-cadastro`)
        }

        if (!existing.phone) {
          return NextResponse.redirect(`${origin}/completar-cadastro`)
        }
      }

      return NextResponse.redirect(`${origin}/sucesso`)
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`)
}
