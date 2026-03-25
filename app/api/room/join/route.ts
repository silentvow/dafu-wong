import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { PLAYER_COLORS, STARTING_MONEY } from '@/lib/board-config'

export async function POST(req: NextRequest) {
  const { playerName, roomId } = await req.json()
  if (!playerName?.trim()) return NextResponse.json({ error: '請輸入名字' }, { status: 400 })
  if (!roomId?.trim()) return NextResponse.json({ error: '請輸入房間號碼' }, { status: 400 })

  const db = createServerClient()
  const code = roomId.trim().toUpperCase()

  // Check room exists and is waiting
  const { data: room } = await db.from('rooms').select().eq('id', code).single()
  if (!room) return NextResponse.json({ error: '找不到房間' }, { status: 404 })
  if (room.status !== 'waiting') return NextResponse.json({ error: '遊戲已開始' }, { status: 400 })

  // Count existing players
  const { data: players } = await db.from('players').select().eq('room_id', code)
  if ((players?.length ?? 0) >= 8) {
    return NextResponse.json({ error: '房間已滿（最多 8 人）' }, { status: 400 })
  }

  const playerId = crypto.randomUUID()
  const colorIdx = players?.length ?? 0

  const { error } = await db.from('players').insert({
    id: playerId,
    room_id: code,
    name: playerName.trim(),
    color: PLAYER_COLORS[colorIdx],
    turn_order: colorIdx,
    position: 0,
    money: STARTING_MONEY,
    children: 0,
    in_jail: false,
    jail_turns: 0,
    is_bankrupt: false,
    next_date_double: false,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ roomId: code, playerId })
}
