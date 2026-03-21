import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getUserId } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: datatableId } = await params
  const db = createAdminClient()
  // Verify ownership
  const { data: dt } = await db.from('datatables').select('id').eq('id', datatableId).eq('user_id', userId).single()
  if (!dt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await db.from('datatable_rows').select('*').eq('datatable_id', datatableId).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: datatableId } = await params
  const db = createAdminClient()
  const { data: dt } = await db.from('datatables').select('id').eq('id', datatableId).eq('user_id', userId).single()
  if (!dt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { data, error } = await db.from('datatable_rows').insert({
    id: uuidv4(),
    datatable_id: datatableId,
    user_id: userId,
    data: body.data ?? {},
    created_at: new Date().toISOString(),
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: datatableId } = await params
  const db = createAdminClient()
  const { data: dt } = await db.from('datatables').select('id').eq('id', datatableId).eq('user_id', userId).single()
  if (!dt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id: rowId } = await req.json()
  const { error } = await db.from('datatable_rows').delete().eq('id', rowId).eq('datatable_id', datatableId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
