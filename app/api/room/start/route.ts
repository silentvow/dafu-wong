import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { roomId, playerId } = await req.json()
  const db = createServerClient()

  const { data: players } = await db.from('players').select().eq('room_id', roomId)
  if (!players || players.length < 2) {
    return NextResponse.json({ error: '至少需要 2 名玩家' }, { status: 400 })
  }

  // Shuffle turn order
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  for (let i = 0; i < shuffled.length; i++) {
    await db.from('players').update({ turn_order: i }).eq('id', shuffled[i].id)
  }

  // Create game state
  const firstPlayer = shuffled[0]
  const { error: gsErr } = await db.from('game_state').insert({
    room_id: roomId,
    current_player_id: firstPlayer.id,
    turn_number: 1,
    phase: 'rolling',
    phase_data: {},
    properties: {},
    orphanage: 0,
  })
  if (gsErr) return NextResponse.json({ error: gsErr.message }, { status: 500 })

  // Update room status
  await db.from('rooms').update({ status: 'playing' }).eq('id', roomId)

  // Add log
  await db.from('game_log').insert({
    room_id: roomId,
    message: `遊戲開始！先手：${firstPlayer.name}`,
  })

  return NextResponse.json({ ok: true })
}
