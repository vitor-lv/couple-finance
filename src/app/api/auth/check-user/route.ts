import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabase as adminSupabase } from '@/lib/supabase'

export async function GET() {
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
    if (!user?.email) return NextResponse.json({ hasPhone: false })

    const { data } = await adminSupabase
      .from('users')
      .select('phone')
      .eq('email', user.email)
      .limit(1)

    const hasPhone = !!(data?.[0]?.phone)
    return NextResponse.json({ hasPhone })
  } catch {
    return NextResponse.json({ hasPhone: false })
  }
}
