import { NextResponse } from 'next/server'
import { supabase as adminSupabase } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/auth-server'

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return NextResponse.json({ hasPhone: false })

    const { data } = await adminSupabase
      .from('users')
      .select('phone')
      .eq('email', user.email)
      .limit(1)

    return NextResponse.json({ hasPhone: !!(data?.[0]?.phone) })
  } catch {
    return NextResponse.json({ hasPhone: false })
  }
}
