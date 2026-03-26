import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  rollDice, movePlayer, calcRent, applyCardEffect,
  nextPlayerIndex, resolveDateRoll, randomCard,
} from '@/lib/game-engine'
import {
  BOARD, SALARY, HOSPITAL_PER_CHILD,
  DATE_FEE, STEAL_COST, WIN_CHILDREN,
  CHANCE_CARDS, FATE_CARDS,
  calcSalary, calcWorkBonus,
} from '@/lib/board-config'
import { Player, GameState, PhaseData, PropertyState } from '@/lib/types'

type ActionType =
  | 'roll'
  | 'buy_property'
  | 'skip_buy'
  | 'attempt_steal'
  | 'skip_steal'
  | 'steal_roll'
  | 'pick_date_partner'
  | 'skip_date'
  | 'date_roll'
  | 'party_roll'
  | 'end_turn'

async function log(db: ReturnType<typeof createServerClient>, roomId: string, message: string) {
  await db.from('game_log').insert({ room_id: roomId, message })
}

export async function POST(req: NextRequest) {
  const { roomId, playerId, action, data } = await req.json() as {
    roomId: string
    playerId: string
    action: ActionType
    data?: Record<string, unknown>
  }

  const db = createServerClient()

  // Load state
  const { data: gs } = await db.from('game_state').select().eq('room_id', roomId).single()
  const { data: playersRaw } = await db.from('players').select().eq('room_id', roomId)

  if (!gs || !playersRaw) return NextResponse.json({ error: '找不到遊戲' }, { status: 404 })

  const state = gs as GameState
  const players = playersRaw as Player[]
  const me = players.find(p => p.id === playerId)
  if (!me) return NextResponse.json({ error: '找不到玩家' }, { status: 404 })

  async function updateState(phase: string, phaseData: PhaseData) {
    await db.from('game_state').update({
      phase,
      phase_data: phaseData,
      updated_at: new Date().toISOString(),
    }).eq('room_id', roomId)
  }

  async function updatePlayer(id: string, updates: Partial<Player>) {
    await db.from('players').update(updates).eq('id', id)
  }

  async function endTurn() {
    const fresh = await db.from('players').select().eq('room_id', roomId)
    const freshPlayers = (fresh.data ?? []) as Player[]

    // Near-win warning: someone has enough children but hasn't passed start yet
    for (const p of freshPlayers.filter(p => !p.is_bankrupt && p.children >= WIN_CHILDREN)) {
      await log(db, roomId, `⚠️ ${p.name} 已集齊 ${p.children} 個孩子！只差一步——再經過起點，王者加冕！`)
    }

    const nextId = nextPlayerIndex(freshPlayers, state.current_player_id!)
    const nextPlayer = freshPlayers.find(p => p.id === nextId)!
    const nextTurn = nextId === state.current_player_id
      ? state.turn_number + 1
      : state.turn_number
    await db.from('game_state').update({
      current_player_id: nextId,
      turn_number: nextTurn,
      phase: 'rolling',
      phase_data: {},
      updated_at: new Date().toISOString(),
    }).eq('room_id', roomId)
    await log(db, roomId, `⏭️ 換 ${nextPlayer.name} 出手了！`)
  }

  // ── ACTIONS ──

  if (action === 'roll') {
    if (state.phase !== 'rolling') return NextResponse.json({ error: '現在不能擲骰' }, { status: 400 })
    if (state.current_player_id !== playerId) return NextResponse.json({ error: '不是你的回合' }, { status: 400 })

    const die = rollDice()
    const { newPosition, passedStart } = movePlayer(me, die)

    let moneyGain = 0
    if (passedStart) {
      moneyGain = calcSalary(me.children)
      // Check win IMMEDIATELY before landing effects
      if (me.children >= WIN_CHILDREN) {
        await updatePlayer(playerId, { position: newPosition, money: me.money + moneyGain })
        await log(db, roomId, `🎲 ${me.name} 擲出 ${die} 點，前往 ${BOARD[newPosition].name}`)
        await log(db, roomId, `${me.name} 帶著 ${me.children} 個孩子越過終點線，榮耀時刻到來！`)
        await db.from('game_state').update({
          phase: 'finished',
          phase_data: { winner_id: playerId },
          updated_at: new Date().toISOString(),
        }).eq('room_id', roomId)
        await db.from('rooms').update({ status: 'finished', winner_id: playerId }).eq('id', roomId)
        await log(db, roomId, `🏆 ${me.name} 以 ${me.children} 個孩子笑傲群雄，勝出！`)
        return NextResponse.json({ ok: true })
      }
      await log(db, roomId, `💵 ${me.name} 領薪日！過起點收入 $${moneyGain}（育有 ${me.children} 個孩子）`)
    }

    await updatePlayer(playerId, {
      position: newPosition,
      money: me.money + moneyGain,
    })
    await log(db, roomId, `🎲 ${me.name} 擲出 ${die} 點，前往 ${BOARD[newPosition].name}`)

    const updatedMe = { ...me, position: newPosition, money: me.money + moneyGain }
    await landOnSquare(db, roomId, playerId, updatedMe, newPosition, players, state, die)
    return NextResponse.json({ ok: true })
  }

  if (action === 'buy_property') {
    if (state.phase !== 'buy_property') return NextResponse.json({ error: 'wrong phase' }, { status: 400 })
    if (state.current_player_id !== playerId) return NextResponse.json({ error: '不是你的回合' }, { status: 400 })
    const sq = BOARD[me.position]
    if (!sq.price) return NextResponse.json({ error: 'no price' }, { status: 400 })
    await updatePlayer(playerId, { money: me.money - sq.price })
    const newProps = { ...state.properties, [me.position]: { owner_id: playerId, houses: 0 } }
    await db.from('game_state').update({ properties: newProps, updated_at: new Date().toISOString() }).eq('room_id', roomId)
    await log(db, roomId, `🏠 ${me.name} 出手購得 ${sq.name}，花費 $${sq.price}`)
    await updateState('end_turn', {})
    return NextResponse.json({ ok: true })
  }

  if (action === 'skip_buy') {
    if (state.current_player_id !== playerId) return NextResponse.json({ error: '不是你的回合' }, { status: 400 })
    await updateState('end_turn', {})
    return NextResponse.json({ ok: true })
  }

  if (action === 'attempt_steal') {
    if (state.phase !== 'steal_option') return NextResponse.json({ error: 'wrong phase' }, { status: 400 })
    if (state.current_player_id !== playerId) return NextResponse.json({ error: '不是你的回合' }, { status: 400 })
    const pd = state.phase_data
    const victim = players.find(p => p.id === pd.property_owner)
    if (!victim) return NextResponse.json({ error: '找不到受害者' }, { status: 400 })
    if (me.money < STEAL_COST) return NextResponse.json({ error: '錢不夠搶劫' }, { status: 400 })

    await updatePlayer(playerId, { money: me.money - STEAL_COST })
    await log(db, roomId, `⚔️ ${me.name} 砸下 $${STEAL_COST}，向 ${victim.name} 發動奪子行動！雙方擲骰決勝負！`)
    await updateState('steal_rolling', {
      thief_id: playerId,
      victim_id: victim.id,
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'skip_steal') {
    if (state.current_player_id !== playerId) return NextResponse.json({ error: '不是你的回合' }, { status: 400 })
    await updateState('end_turn', {})
    return NextResponse.json({ ok: true })
  }

  if (action === 'steal_roll') {
    if (state.phase !== 'steal_rolling') return NextResponse.json({ error: 'wrong phase' }, { status: 400 })
    const pd = state.phase_data
    if (playerId !== pd.thief_id && playerId !== pd.victim_id) {
      return NextResponse.json({ error: '你不在這次搶奪中' }, { status: 400 })
    }
    if (playerId === pd.thief_id && pd.thief_roll !== undefined) {
      return NextResponse.json({ error: '你已經擲過骰了' }, { status: 400 })
    }
    if (playerId === pd.victim_id && pd.victim_roll !== undefined) {
      return NextResponse.json({ error: '你已經擲過骰了' }, { status: 400 })
    }

    const roll = rollDice()
    await log(db, roomId, `${me.name} 奪子擲骰：${roll}`)

    const newPd: PhaseData = { ...pd }
    if (playerId === pd.thief_id) {
      newPd.thief_roll = roll
    } else {
      newPd.victim_roll = roll
    }

    if (newPd.thief_roll !== undefined && newPd.victim_roll !== undefined) {
      const thief = players.find(p => p.id === pd.thief_id)!
      const victim = players.find(p => p.id === pd.victim_id)!
      if (newPd.thief_roll > newPd.victim_roll) {
        if (victim.children > 0) {
          await updatePlayer(thief.id, { children: thief.children + 1 })
          await updatePlayer(victim.id, { children: Math.max(0, victim.children - 1) })
          await log(db, roomId, `😈 ${thief.name} 以 ${newPd.thief_roll} 勝 ${newPd.victim_roll}，搶走 ${victim.name} 一個孩子！`)
        } else {
          await log(db, roomId, `${victim.name} 膝下無子，${thief.name} 撲了個空...`)
        }
      } else {
        await log(db, roomId, `😮‍💨 ${thief.name} 擲出 ${newPd.thief_roll}，敗給 ${victim.name} 的 ${newPd.victim_roll}，奪子失敗！`)
      }
      await updateState('end_turn', {})
    } else {
      await updateState('steal_rolling', newPd)
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'pick_date_partner') {
    if (state.phase !== 'date_select') return NextResponse.json({ error: 'wrong phase' }, { status: 400 })
    if (state.current_player_id !== playerId) return NextResponse.json({ error: '不是你的回合' }, { status: 400 })
    const partnerId = data?.partnerId as string
    if (!partnerId || partnerId === playerId) return NextResponse.json({ error: '選一名其他玩家' }, { status: 400 })

    const partner = players.find(p => p.id === partnerId)
    if (!partner) return NextResponse.json({ error: '找不到玩家' }, { status: 400 })

    await updatePlayer(playerId, { money: me.money - DATE_FEE })
    await log(db, roomId, `💞 ${me.name} 邀請 ${partner.name} 共赴汽車旅館！發起者豪擲 $${DATE_FEE}`)

    await updateState('date_rolling', {
      initiator_id: playerId,
      partner_id: partnerId,
    })
    return NextResponse.json({ ok: true })
  }

  if (action === 'skip_date') {
    if (state.phase !== 'date_select') return NextResponse.json({ error: 'wrong phase' }, { status: 400 })
    if (state.current_player_id !== playerId) return NextResponse.json({ error: '不是你的回合' }, { status: 400 })
    await log(db, roomId, `${me.name} 婉拒了本次邀約，獨自離去`)
    await updateState('end_turn', {})
    return NextResponse.json({ ok: true })
  }

  if (action === 'date_roll') {
    if (state.phase !== 'date_rolling') return NextResponse.json({ error: 'wrong phase' }, { status: 400 })
    const pd = state.phase_data
    if (playerId !== pd.initiator_id && playerId !== pd.partner_id) {
      return NextResponse.json({ error: '你不在這次約會中' }, { status: 400 })
    }

    const myTotal = rollDice()
    await log(db, roomId, `${me.name} 約會擲骰出擊：${myTotal}`)

    const newPd: PhaseData = { ...pd }
    if (playerId === pd.initiator_id) {
      newPd.initiator_roll = myTotal
    } else {
      newPd.partner_roll = myTotal
    }

    if (newPd.initiator_roll !== undefined && newPd.partner_roll !== undefined) {
      const initiator = players.find(p => p.id === pd.initiator_id)!
      const partner = players.find(p => p.id === pd.partner_id)!
      const result = resolveDateRoll(
        newPd.initiator_roll,
        newPd.partner_roll,
        pd.initiator_id!,
        pd.partner_id!,
        initiator.next_date_double,
      )
      if (result.winnerId) {
        const winner = players.find(p => p.id === result.winnerId)!
        await updatePlayer(result.winnerId, { children: winner.children + result.childrenGained })
        if (initiator.next_date_double) {
          await updatePlayer(initiator.id, { next_date_double: false })
        }
        await log(db, roomId, `💕 ${result.message} ${winner.name} 喜獲 ${result.childrenGained} 個孩子！`)
      } else {
        await log(db, roomId, result.message)
      }
      await updateState('end_turn', {})
    } else {
      await updateState('date_rolling', newPd)
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'party_roll') {
    if (state.phase !== 'party_rolling') return NextResponse.json({ error: 'wrong phase' }, { status: 400 })
    const pd = state.phase_data
    const partyRolls: Record<string, number> = { ...(pd.party_rolls ?? {}) }
    if (partyRolls[playerId] !== undefined) {
      return NextResponse.json({ error: '你已經擲過骰了' }, { status: 400 })
    }

    const roll = rollDice()
    partyRolls[playerId] = roll
    await log(db, roomId, `🎲 ${me.name} 派對擲骰：${roll}`)

    const activePlayers = players.filter(p => !p.is_bankrupt)
    const allRolled = activePlayers.every(p => partyRolls[p.id] !== undefined)

    if (allRolled) {
      const maxRoll = Math.max(...Object.values(partyRolls))
      const winners = activePlayers.filter(p => partyRolls[p.id] === maxRoll)
      for (const winner of winners) {
        await db.from('players').update({ children: winner.children + 1 }).eq('id', winner.id)
      }
      const winnerNames = winners.map(p => p.name).join('、')
      await log(db, roomId, `🏆 派對結束！${winnerNames} 以 ${maxRoll} 點奪冠，各得 1 個孩子！`)
      await db.from('game_state').update({
        phase: 'end_turn',
        phase_data: {},
        updated_at: new Date().toISOString(),
      }).eq('room_id', roomId)
    } else {
      await db.from('game_state').update({
        phase_data: { ...pd, party_rolls: partyRolls },
        updated_at: new Date().toISOString(),
      }).eq('room_id', roomId)
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'end_turn') {
    if (state.phase !== 'end_turn') return NextResponse.json({ error: 'wrong phase' }, { status: 400 })
    if (state.current_player_id !== playerId) return NextResponse.json({ error: '不是你的回合' }, { status: 400 })
    await endTurn()
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: '未知動作' }, { status: 400 })
}

// ── Landing logic ──
async function landOnSquare(
  db: ReturnType<typeof createServerClient>,
  roomId: string,
  playerId: string,
  player: Player,
  squareId: number,
  players: Player[],
  state: GameState,
  die: number,
) {
  const sq = BOARD[squareId]

  const updateState = async (phase: string, phaseData: PhaseData) => {
    await db.from('game_state').update({
      phase, phase_data: phaseData, updated_at: new Date().toISOString(),
    }).eq('room_id', roomId)
  }

  const updatePlayer = async (id: string, updates: Partial<Player>) => {
    await db.from('players').update(updates).eq('id', id)
  }

  async function applyPropertiesUpdate(propertiesUpdate: Record<string, PropertyState | null>) {
    const newProps = { ...state.properties }
    for (const [sqId, propState] of Object.entries(propertiesUpdate)) {
      if (propState === null) {
        delete newProps[sqId]
      } else {
        newProps[sqId] = propState
      }
    }
    await db.from('game_state').update({
      properties: newProps,
      updated_at: new Date().toISOString(),
    }).eq('room_id', roomId)
  }

  switch (sq.type) {
    case 'start':
      await updateState('end_turn', {})
      break

    case 'party': {
      const partyFee = Math.floor(player.money * 0.5)
      await updatePlayer(playerId, { money: player.money - partyFee })
      await log(db, roomId, `🎉 ${player.name} 舉辦多人派對，豪擲 $${partyFee}！所有玩家請擲骰，點數最高者得孩子！`)
      await updateState('party_rolling', { host_id: playerId, party_rolls: {} })
      break
    }

    case 'work': {
      const workIncome = calcWorkBonus(player.children)
      await updatePlayer(playerId, { money: player.money + workIncome })
      await log(db, roomId, `💼 ${player.name} 努力工作，收入 $${workIncome}（育有 ${player.children} 個孩子）`)
      await updateState('end_turn', {})
      break
    }

    case 'hospital': {
      if (player.children === 0) {
        await log(db, roomId, `${player.name} 健檢通過，膝下無子，免費輕鬆過關`)
        await updateState('end_turn', {})
      } else {
        const fee = player.children * HOSPITAL_PER_CHILD
        await updatePlayer(playerId, { money: player.money - fee })
        await log(db, roomId, `🏥 ${player.name} 帶 ${player.children} 個孩子健檢，合計花費 $${fee}`)
        await updateState('end_turn', {})
      }
      break
    }

    case 'property': {
      const prop = state.properties[squareId]
      if (!prop) {
        await updateState('buy_property', { landed_square: squareId, dice: die })
      } else if (prop.owner_id === playerId) {
        await log(db, roomId, `${player.name} 踏上自家地盤 ${sq.name}，安心！`)
        await updateState('end_turn', {})
      } else {
        const rent = calcRent(squareId, state.properties)
        const owner = players.find(p => p.id === prop.owner_id)
        await updatePlayer(playerId, { money: player.money - rent })
        if (owner) await db.from('players').update({ money: owner.money + rent }).eq('id', owner.id)
        await log(db, roomId, `${player.name} 踏入 ${owner?.name} 的地盤 ${sq.name}，繳租 $${rent}`)

        if (owner && owner.children > 0 && player.money - rent >= STEAL_COST) {
          await updateState('steal_option', {
            landed_square: squareId,
            property_owner: prop.owner_id,
            rent_amount: rent,
            dice: die,
          })
        } else {
          await updateState('end_turn', {})
        }
      }
      break
    }

    case 'date': {
      const others = players.filter(p => p.id !== playerId && !p.is_bankrupt)
      if (others.length === 0) {
        await log(db, roomId, `${player.name} 到了汽車旅館，卻發現無人可約，遺憾離去`)
        await updateState('end_turn', {})
      } else {
        await updateState('date_select', { initiator_id: playerId, dice: die })
      }
      break
    }

    case 'chance': {
      const card = randomCard(CHANCE_CARDS)
      await log(db, roomId, `📦 ${player.name} 抽到機會：${card.text}`)
      const result = applyCardEffect(card.effect, player, players, state)
      if (Object.keys(result.playerUpdates).length > 0) {
        await updatePlayer(playerId, result.playerUpdates)
      }
      for (const upd of result.otherUpdates ?? []) {
        const fields: Partial<Player> = {}
        if (upd.money !== undefined) fields.money = upd.money
        if (upd.children !== undefined) fields.children = upd.children
        if (Object.keys(fields).length > 0) {
          await db.from('players').update(fields).eq('id', upd.id)
        }
      }
      if (result.propertiesUpdate) {
        await applyPropertiesUpdate(result.propertiesUpdate)
      }
      await log(db, roomId, result.logMessage)
      if (result.teleportTo !== undefined) {
        const dest = BOARD[result.teleportTo]
        if (dest.type === 'date') {
          const others = players.filter(p => p.id !== playerId && !p.is_bankrupt)
          if (others.length > 0) {
            await updateState('date_select', { initiator_id: playerId })
            break
          }
        }
      }
      await updateState('end_turn', {})
      break
    }

    case 'fate': {
      const card = randomCard(FATE_CARDS)
      await log(db, roomId, `🎴 ${player.name} 抽到命運：${card.text}`)
      const result = applyCardEffect(card.effect, player, players, state)
      if (Object.keys(result.playerUpdates).length > 0) {
        await updatePlayer(playerId, result.playerUpdates)
      }
      for (const upd of result.otherUpdates ?? []) {
        const fields: Partial<Player> = {}
        if (upd.money !== undefined) fields.money = upd.money
        if (upd.children !== undefined) fields.children = upd.children
        if (Object.keys(fields).length > 0) {
          await db.from('players').update(fields).eq('id', upd.id)
        }
      }
      if (result.propertiesUpdate) {
        await applyPropertiesUpdate(result.propertiesUpdate)
      }
      await log(db, roomId, result.logMessage)
      await updateState('end_turn', {})
      break
    }

    default:
      await updateState('end_turn', {})
  }
}
