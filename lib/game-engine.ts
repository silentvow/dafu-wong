import {
  Player, GameState, PhaseData, PropertyState, CardEffect
} from './types'
import {
  BOARD, COLOR_GROUPS, TOTAL_SQUARES, WIN_CHILDREN,
  SALARY, TAX_AMOUNT, HOSPITAL_PER_CHILD,
  DATE_FEE, STEAL_COST,
  CHANCE_CARDS, FATE_CARDS, GameCard,
} from './board-config'

function randRange(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1
}

export function randomCard(deck: GameCard[]): GameCard {
  return deck[Math.floor(Math.random() * deck.length)]
}

/** Returns the effective rent for landing on a property */
export function calcRent(
  squareId: number,
  properties: Record<string, PropertyState>
): number {
  const square = BOARD[squareId]
  if (!square.rent || !square.color) return 0
  const prop = properties[squareId]
  if (!prop) return 0

  const group = COLOR_GROUPS[square.color] ?? []
  const ownsAll = group.every(id => properties[id]?.owner_id === prop.owner_id)
  return ownsAll ? square.rent[1] : square.rent[0]
}

/** Move player forward, handle passing start */
export function movePlayer(
  player: Player,
  steps: number
): { newPosition: number; passedStart: boolean } {
  const newPosition = (player.position + steps) % TOTAL_SQUARES
  const passedStart = player.position + steps >= TOTAL_SQUARES
  return { newPosition, passedStart }
}

/** Find nearest date square ahead of current position */
export function nearestDateSquare(position: number): number {
  for (let i = 1; i <= TOTAL_SQUARES; i++) {
    const sq = BOARD[(position + i) % TOTAL_SQUARES]
    if (sq.type === 'date') return sq.id
  }
  return 2 // fallback — first date square
}

/** Apply a card effect and return mutations */
export interface CardResult {
  playerUpdates: Partial<Player>
  otherUpdates?: { id: string; money?: number; children?: number }[]
  propertiesUpdate?: Record<string, PropertyState | null>  // null = unowned
  logMessage: string
  nextPhase: 'rolling' | 'end_turn'
  teleportTo?: number
}

export function applyCardEffect(
  effect: CardEffect,
  player: Player,
  allPlayers: Player[],
  state: GameState
): CardResult {
  const others = allPlayers.filter(p => p.id !== player.id && !p.is_bankrupt)

  switch (effect.type) {
    case 'gain_child':
      return {
        playerUpdates: { children: player.children + effect.amount },
        logMessage: `${player.name} 得到 ${effect.amount} 個孩子！`,
        nextPhase: 'end_turn',
      }

    case 'lose_child':
      return {
        playerUpdates: { children: Math.max(0, player.children - effect.amount) },
        logMessage: `${player.name} 失去了 ${effect.amount} 個孩子...`,
        nextPhase: 'end_turn',
      }

    case 'pay': {
      const amt = effect.min !== undefined && effect.max !== undefined
        ? randRange(effect.min, effect.max)
        : (effect.amount ?? 0)
      return {
        playerUpdates: { money: player.money - amt },
        logMessage: `${player.name} 支付了 $${amt}`,
        nextPhase: 'end_turn',
      }
    }

    case 'receive': {
      const amt = effect.min !== undefined && effect.max !== undefined
        ? randRange(effect.min, effect.max)
        : (effect.amount ?? 0)
      return {
        playerUpdates: { money: player.money + amt },
        logMessage: `${player.name} 獲得了 $${amt}`,
        nextPhase: 'end_turn',
      }
    }

    case 'receive_per_child': {
      const perChild = randRange(effect.min, effect.max)
      const gain = perChild * player.children
      return {
        playerUpdates: { money: player.money + gain },
        logMessage: `${player.name} 每個孩子收紅包 $${perChild}，共 $${gain}`,
        nextPhase: 'end_turn',
      }
    }

    case 'pay_per_child': {
      const perChild = randRange(effect.min, effect.max)
      const cost = perChild * player.children
      return {
        playerUpdates: { money: player.money - cost },
        logMessage: `${player.name} 每個孩子付 $${perChild}，共 $${cost}`,
        nextPhase: 'end_turn',
      }
    }

    case 'collect_from_all_random': {
      const amt = randRange(effect.min, effect.max)
      const total = others.length * amt
      return {
        playerUpdates: { money: player.money + total },
        otherUpdates: others.map(p => ({ id: p.id, money: p.money - amt })),
        logMessage: `${player.name} 孩子生日，向每位玩家收了 $${amt}，共 $${total}！`,
        nextPhase: 'end_turn',
      }
    }

    case 'pay_all_random': {
      const amt = randRange(effect.min, effect.max)
      const total = others.length * amt
      return {
        playerUpdates: { money: player.money - total },
        otherUpdates: others.map(p => ({ id: p.id, money: p.money + amt })),
        logMessage: `${player.name} 破財消災，向每位玩家各付 $${amt}，共 $${total}`,
        nextPhase: 'end_turn',
      }
    }

    case 'sell_child': {
      if (player.children === 0) {
        return {
          playerUpdates: {},
          logMessage: `${player.name} 沒有孩子可以出養...`,
          nextPhase: 'end_turn',
        }
      }
      return {
        playerUpdates: {
          children: player.children - 1,
          money: player.money + effect.amount,
        },
        logMessage: `${player.name} 的孩子被領養，得到 $${effect.amount}`,
        nextPhase: 'end_turn',
      }
    }

    case 'adopt_child':
      return {
        playerUpdates: {
          children: player.children + 1,
          money: player.money - effect.cost,
        },
        logMessage: `${player.name} 花了 $${effect.cost} 領養了一個孩子！`,
        nextPhase: 'end_turn',
      }

    case 'go_to_jail':
      // No jail in this board — no effect
      return {
        playerUpdates: {},
        logMessage: `${player.name} 逃過一劫...`,
        nextPhase: 'end_turn',
      }

    case 'move_to_start':
      return {
        playerUpdates: { position: 0, money: player.money + SALARY },
        logMessage: `${player.name} 回到起點，領了 $${SALARY}`,
        nextPhase: 'end_turn',
        teleportTo: 0,
      }

    case 'move_to_date': {
      const dest = nearestDateSquare(player.position)
      return {
        playerUpdates: { position: dest },
        logMessage: `${player.name} 前進到最近的汽車旅館！`,
        nextPhase: 'end_turn', // caller may override to date_select
        teleportTo: dest,
      }
    }

    case 'next_date_double':
      return {
        playerUpdates: { next_date_double: true },
        logMessage: `${player.name} 下次約會可得雙胞胎！`,
        nextPhase: 'end_turn',
      }

    case 'steal_random': {
      const withChildren = others.filter(p => p.children > 0)
      if (withChildren.length === 0) {
        return {
          playerUpdates: { money: player.money - effect.amount },
          logMessage: `${player.name} 外遇失敗，沒人有孩子可偷...（付了 $${effect.amount}）`,
          nextPhase: 'end_turn',
        }
      }
      const victim = withChildren[Math.floor(Math.random() * withChildren.length)]
      return {
        playerUpdates: {
          children: player.children + 1,
          money: player.money - effect.amount,
        },
        otherUpdates: [{ id: victim.id, children: victim.children - 1 }],
        logMessage: `${player.name} 外遇，從 ${victim.name} 搶走了一個孩子！（付了 $${effect.amount}）`,
        nextPhase: 'end_turn',
      }
    }

    case 'gain_property_random': {
      const allPropIds = BOARD.filter(sq => sq.type === 'property').map(sq => sq.id)
      const eligible = allPropIds.filter(id => state.properties[id]?.owner_id !== player.id)
      if (eligible.length === 0) {
        return {
          playerUpdates: { money: player.money + 1000 },
          logMessage: `${player.name} 天降地契找不到地產，改得 $1,000`,
          nextPhase: 'end_turn',
        }
      }
      const picked = eligible[Math.floor(Math.random() * eligible.length)]
      const sq = BOARD[picked]
      const prevOwner = state.properties[picked]?.owner_id
      const msg = prevOwner
        ? `${player.name} 天降地契！搶走了 ${sq.name}（原主人的地產被搶走了）`
        : `${player.name} 天降地契！獲得了無主的 ${sq.name}`
      return {
        playerUpdates: {},
        propertiesUpdate: { [picked]: { owner_id: player.id, houses: 0 } },
        logMessage: msg,
        nextPhase: 'end_turn',
      }
    }

    case 'lose_property_random': {
      const ownedIds = BOARD
        .filter(sq => sq.type === 'property')
        .map(sq => sq.id)
        .filter(id => state.properties[id]?.owner_id === player.id)
      if (ownedIds.length === 0) {
        return {
          playerUpdates: {},
          logMessage: `${player.name} 天災，但沒有地產可失去`,
          nextPhase: 'end_turn',
        }
      }
      const picked = ownedIds[Math.floor(Math.random() * ownedIds.length)]
      const sq = BOARD[picked]
      return {
        playerUpdates: {},
        propertiesUpdate: { [picked]: null },
        logMessage: `${player.name} 天災！${sq.name} 變回無主地！`,
        nextPhase: 'end_turn',
      }
    }

    case 'steal_child_random': {
      const withChildren = others.filter(p => p.children > 0)
      if (withChildren.length === 0) {
        return {
          playerUpdates: {},
          logMessage: '人口販運，但沒有目標（所有玩家沒有孩子）',
          nextPhase: 'end_turn',
        }
      }
      const victim = withChildren[Math.floor(Math.random() * withChildren.length)]
      return {
        playerUpdates: {},
        otherUpdates: [{ id: victim.id, children: Math.max(0, victim.children - 1) }],
        logMessage: `人口販運！${victim.name} 失去了一個孩子（孩子消失了）`,
        nextPhase: 'end_turn',
      }
    }

    case 'plague': {
      const newChildren = Math.max(0, player.children - 1)
      return {
        playerUpdates: { children: newChildren },
        otherUpdates: others.map(p => ({ id: p.id, children: Math.max(0, p.children - 1) })),
        logMessage: '瘟疫！所有玩家各失去一個孩子 😷',
        nextPhase: 'end_turn',
      }
    }

    case 'all_gain_child':
      return {
        playerUpdates: { children: player.children + 1 },
        otherUpdates: others.map(p => ({ id: p.id, children: p.children + 1 })),
        logMessage: '嬰兒潮！所有玩家各得一個孩子 👶',
        nextPhase: 'end_turn',
      }

    default:
      return { playerUpdates: {}, logMessage: '神秘事件...', nextPhase: 'end_turn' }
  }
}

/** Get the next player in turn order (skip bankrupt players) */
export function nextPlayerIndex(
  players: Player[],
  currentId: string
): string {
  const sorted = [...players].sort((a, b) => a.turn_order - b.turn_order)
  const idx = sorted.findIndex(p => p.id === currentId)
  for (let i = 1; i <= sorted.length; i++) {
    const next = sorted[(idx + i) % sorted.length]
    if (!next.is_bankrupt) return next.id
  }
  return currentId
}

/** Check win condition */
export function checkWin(players: Player[]): Player | null {
  return players.find(p => p.children >= WIN_CHILDREN) ?? null
}

/** Resolve date mechanic - returns who gets the child */
export function resolveDateRoll(
  initiatorRoll: number,
  partnerRoll: number,
  initiatorId: string,
  partnerId: string,
  initiatorHasDouble: boolean
): {
  winnerId: string | null
  childrenGained: number
  message: string
} {
  if (initiatorRoll === partnerRoll) {
    return { winnerId: null, childrenGained: 0, message: '平手！白費感情，沒有孩子 😅' }
  }
  const winnerId = initiatorRoll > partnerRoll ? initiatorId : partnerId
  const childrenGained = winnerId === initiatorId && initiatorHasDouble ? 2 : 1
  return {
    winnerId,
    childrenGained,
    message: `${initiatorRoll > partnerRoll ? '發起者' : '被選者'}獲得孩子！（${initiatorRoll} vs ${partnerRoll}）`,
  }
}

