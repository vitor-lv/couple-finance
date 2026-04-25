import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendTextMessage } from '@/lib/zapi'
import { TIPO } from '@/lib/constants'
import type { FinanceResult } from '@/lib/claude'
import { stripJsonLikeEnvelopeForWhatsApp } from '@/lib/whatsapp-sanitize'

const DUPLICATE_KEY_ERROR_CODE = '23505'

export async function insertUserMessage(
  phone: string,
  senderName: string,
  content: string,
  rawMessage: object
): Promise<boolean> {
  const { error } = await supabase.from('messages').insert({
    phone,
    sender_name: senderName,
    role: 'user',
    content,
    raw_message: rawMessage,
  })

  if (!error) return true
  if (error.code === DUPLICATE_KEY_ERROR_CODE) return false
  throw new Error(`Erro ao salvar mensagem do usuário: ${error.message}`)
}

export async function insertAssistantMessage(phone: string, content: string, context: string): Promise<void> {
  const safeContent = stripJsonLikeEnvelopeForWhatsApp(content)
  const { error } = await supabase.from('messages').insert({
    phone,
    sender_name: 'assistant',
    role: 'assistant',
    content: safeContent,
  })
  if (error) {
    throw new Error(`Erro ao salvar ${context}: ${error.message}`)
  }
}

export async function saveAndSend(
  phone: string,
  senderName: string,
  userContent: string,
  rawMessage: object,
  replyTo: string,
  assistantContent: string,
  context: string
): Promise<NextResponse> {
  const inserted = await insertUserMessage(phone, senderName, userContent, rawMessage)
  if (!inserted) {
    return NextResponse.json({ status: 'ignored_duplicate' })
  }
  await insertAssistantMessage(phone, assistantContent, context)
  await sendTextMessage(replyTo, assistantContent)
  return NextResponse.json({ status: 'ok' })
}

export async function saveAndReply(
  userPhone: string,
  replyTo: string,
  senderName: string,
  userContent: string,
  rawMessage: object,
  result: FinanceResult
): Promise<boolean> {
  const inserted = await insertUserMessage(userPhone, senderName, userContent, rawMessage)
  if (!inserted) return false

  const safeResposta = stripJsonLikeEnvelopeForWhatsApp(result.resposta)
  const { error: assistantError } = await supabase.from('messages').insert({
    phone: userPhone,
    sender_name: 'assistant',
    role: 'assistant',
    content: safeResposta,
  })
  if (assistantError) {
    throw new Error(`Erro ao salvar resposta do assistant: ${assistantError.message}`)
  }

  if (result.tipo === TIPO.MULTIPLOS_GASTOS && result.transacoes?.length) {
    for (const tx of result.transacoes) {
      if ((tx.tipo === TIPO.GASTO || tx.tipo === TIPO.RECEITA) && tx.valor) {
        const { error: txError } = await supabase.from('transactions').insert({
          phone:       userPhone,
          sender_name: senderName,
          tipo:        tx.tipo,
          valor:       tx.valor,
          categoria:   tx.categoria,
          descricao:   tx.descricao,
          data:        tx.data ?? new Date().toISOString().split('T')[0],
        })
        if (txError) {
          console.error('❌ Erro ao salvar transaction:', JSON.stringify(txError))
        } else {
          console.log(`✅ Transaction salva: ${tx.tipo} R$${tx.valor} (${userPhone})`)
        }
      }
    }
  } else if ((result.tipo === TIPO.GASTO || result.tipo === TIPO.RECEITA) && result.valor) {
    const { error: txError } = await supabase.from('transactions').insert({
      phone:       userPhone,
      sender_name: senderName,
      tipo:        result.tipo,
      valor:       result.valor,
      categoria:   result.categoria,
      descricao:   result.descricao,
      data:        result.data ?? new Date().toISOString().split('T')[0],
    })
    if (txError) {
      console.error('❌ Erro ao salvar transaction:', JSON.stringify(txError))
    } else {
      console.log(`✅ Transaction salva: ${result.tipo} R$${result.valor} (${userPhone})`)
    }
  }

  await sendTextMessage(replyTo, safeResposta)
  return true
}
