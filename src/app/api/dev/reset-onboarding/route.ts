import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const phone = req.nextUrl.searchParams.get('phone')

  if (secret !== process.env.DEV_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // list mode: return all phones to help find the right format
  if (!phone || phone === 'list') {
    const { data, error } = await supabase.from('users').select('phone, nickname, onboarding_step, onboarding_completed')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ users: data })
  }

  const { data: updated, error } = await supabase
    .from('users')
    .update({
      onboarding_completed: false,
      onboarding_step: -1,
      nickname: null,
      goal_category: null,
      goal_description: null,
      goal_amount: null,
      monthly_income: null,
      monthly_savings_goal: null,
      fixed_expenses: null,
      financial_score: null,
      editing_field: null,
    })
    .ilike('phone', `%${phone}%`)
    .select('phone')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!updated?.length) {
    return NextResponse.json({ error: 'Nenhum usuário encontrado', phone }, { status: 404 })
  }

  const phones = updated.map(u => u.phone)
  const { error: txError } = await supabase.from('transactions').delete().in('phone', phones)
  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 })
  }

  const { error: msgError } = await supabase.from('messages').delete().in('phone', phones)
  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: phones })
}
