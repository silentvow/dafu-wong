import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { PLAYER_COLORS, STARTING_MONEY } from '@/lib/board-config'

function genRoomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function genPlayerId(): string {
  return crypto.randomUUID()
}

export async function POST(req: NextRequest) {
  const { playerName } = await req.json()
  if (!playerName?.trim()) {
    return NextResponse.json({ error: '請輸入名字' }, { status: 400 })
  }

  const db = createServerClient()

  // Create room
  const roomId = genRoomId()
  const { error: roomErr } = await db.from('rooms').insert({
    id: roomId,
    status: 'waiting',
  })
  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 })

  // Create host player
  const playerId = genPlayerId()
  const { error: playerErr } = await db.from('players').insert({
    id: playerId,
    room_id: roomId,
    name: playerName.trim(),
    color: PLAYER_COLORS[0],
    turn_order: 0,
    position: 0,
    money: STARTING_MONEY,
    children: 0,
    is_bankrupt: false,
    next_date_double: false,
  })
  if (playerErr) return NextResponse.json({ error: playerErr.message }, { status: 500 })

  return NextResponse.json({ roomId, playerId })
}
