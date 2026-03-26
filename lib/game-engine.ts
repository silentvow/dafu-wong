import {
  Player, GameState, PhaseData, PropertyState, CardEffect
} from './types'
import {
  BOARD, COLOR_GROUPS, TOTAL_SQUARES, WIN_CHILDREN,
  SALARY, TAX_AMOUNT, HOSPITAL_PER_CHILD,
  DATE_FEE,
  CHANCE_CARDS, FATE_CARDS, GameCard,
  calcSalary,
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
        logMessage: `🍼 ${player.name} 喜獲 ${effect.amount} 個孩子，家庭又壯大了！`,
        nextPhase: 'end_turn',
      }

    case 'lose_child':
      return {
        playerUpdates: { children: Math.max(0, player.children - effect.amount) },
        logMessage: `😢 ${player.name} 失去了 ${effect.amount} 個孩子，令人心碎...`,
        nextPhase: 'end_turn',
      }

    case 'pay': {
      const amt = effect.min !== undefined && effect.max !== undefined
        ? randRange(effect.min, effect.max)
        : (effect.amount ?? 0)
      return {
        playerUpdates: { money: player.money - amt },
        logMessage: `💸 ${player.name} 荷包大失血 $${amt}`,
        nextPhase: 'end_turn',
      }
    }

    case 'receive': {
      const amt = effect.min !== undefined && effect.max !== undefined
        ? randRange(effect.min, effect.max)
        : (effect.amount ?? 0)
      return {
        playerUpdates: { money: player.money + amt },
        logMessage: `💰 ${player.name} 意外進帳 $${amt}，笑開懷！`,
        nextPhase: 'end_turn',
      }
    }

    case 'receive_per_child': {
      const perChild = randRange(effect.min, effect.max)
      const gain = perChild * player.children
      return {
        playerUpdates: { money: player.money + gain },
        logMessage: `🧧 ${player.name} 每個孩子收到 $${perChild} 紅包，共進帳 $${gain}！`,
        nextPhase: 'end_turn',
      }
    }

    case 'pay_per_child': {
      const perChild = randRange(effect.min, effect.max)
      const cost = perChild * player.children
      return {
        playerUpdates: { money: player.money - cost },
        logMessage: `😩 ${player.name} 每個孩子花費 $${perChild}，荷包縮水 $${cost}！`,
        nextPhase: 'end_turn',
      }
    }

    case 'collect_from_all_random': {
      const amt = randRange(effect.min, effect.max)
      const total = others.length * amt
      return {
        playerUpdates: { money: player.money + total },
        otherUpdates: others.map(p => ({ id: p.id, money: p.money - amt })),
        logMessage: `🎂 ${player.name} 的孩子慶生！向每位玩家各收 $${amt}，大豐收 $${total}！`,
        nextPhase: 'end_turn',
      }
    }

    case 'pay_all_random': {
      const amt = randRange(effect.min, effect.max)
      const total = others.length * amt
      return {
        playerUpdates: { money: player.money - total },
        otherUpdates: others.map(p => ({ id: p.id, money: p.money + amt })),
        logMessage: `💸 ${player.name} 花錢消災，向每位玩家各付 $${amt}，共出血 $${total}`,
        nextPhase: 'end_turn',
      }
    }

    case 'sell_child': {
      if (player.children === 0) {
        return {
          playerUpdates: {},
          logMessage: `${player.name} 膝下無子，無孩可送養，只能嘆氣...`,
          nextPhase: 'end_turn',
        }
      }
      return {
        playerUpdates: {
          children: player.children - 1,
          money: player.money + effect.amount,
        },
        logMessage: `${player.name} 忍痛送養一個孩子，領得 $${effect.amount}`,
        nextPhase: 'end_turn',
      }
    }

    case 'adopt_child':
      return {
        playerUpdates: {
          children: player.children + 1,
          money: player.money - effect.cost,
        },
        logMessage: `🏠 ${player.name} 花了 $${effect.cost} 迎接新成員！恭喜得子！`,
        nextPhase: 'end_turn',
      }

    case 'go_to_jail':
      // No jail in this board — no effect
      return {
        playerUpdates: {},
        logMessage: `${player.name} 有驚無險，化險為夷！`,
        nextPhase: 'end_turn',
      }

    case 'move_to_start': {
      const salary = calcSalary(player.children)
      return {
        playerUpdates: { position: 0, money: player.money + salary },
        logMessage: `${player.name} 直奔起點，薪水入袋 $${salary}（${player.children} 個孩子）`,
        nextPhase: 'end_turn',
        teleportTo: 0,
      }
    }

    case 'move_to_date': {
      const dest = nearestDateSquare(player.position)
      return {
        playerUpdates: { position: dest },
        logMessage: `💞 ${player.name} 心動難耐，直衝汽車旅館！`,
        nextPhase: 'end_turn', // caller may override to date_select
        teleportTo: dest,
      }
    }

    case 'next_date_double':
      return {
        playerUpdates: { next_date_double: true },
        logMessage: `✨ ${player.name} 下次約會藥效加倍，有望雙喜臨門！`,
        nextPhase: 'end_turn',
      }

    case 'steal_random': {
      const withChildren = others.filter(p => p.children > 0)
      if (withChildren.length === 0) {
        return {
          playerUpdates: { money: player.money - effect.amount },
          logMessage: `${player.name} 想外遇，奈何所有人膝下空空，白花 $${effect.amount}`,
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
        logMessage: `😏 ${player.name} 外遇得逞！從 ${victim.name} 帶走了一個孩子（花了 $${effect.amount}）`,
        nextPhase: 'end_turn',
      }
    }

    case 'gain_property_random': {
      const allPropIds = BOARD.filter(sq => sq.type === 'property').map(sq => sq.id)
      const eligible = allPropIds.filter(id => state.properties[id]?.owner_id !== player.id)
      if (eligible.length === 0) {
        return {
          playerUpdates: { money: player.money + 1000 },
          logMessage: `${player.name} 天降地契，卻無地可得，改收 $1,000 補償金`,
          nextPhase: 'end_turn',
        }
      }
      const picked = eligible[Math.floor(Math.random() * eligible.length)]
      const sq = BOARD[picked]
      const prevOwner = state.properties[picked]?.owner_id
      const msg = prevOwner
        ? `🏠 ${player.name} 天降地契！強佔了 ${sq.name}，原主人哭了`
        : `🏠 ${player.name} 天降地契！喜獲無主的 ${sq.name}，免費入手！`
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
          logMessage: `${player.name} 遭逢天災，所幸名下無地，有驚無險`,
          nextPhase: 'end_turn',
        }
      }
      const picked = ownedIds[Math.floor(Math.random() * ownedIds.length)]
      const sq = BOARD[picked]
      return {
        playerUpdates: {},
        propertiesUpdate: { [picked]: null },
        logMessage: `💥 ${player.name} 天災橫禍！${sq.name} 化為無主之地！`,
        nextPhase: 'end_turn',
      }
    }

    case 'steal_child_random': {
      // Always pick from all others — name the target even if they have no children
      if (others.length === 0) {
        return {
          playerUpdates: {},
          logMessage: '人口販運出動，但場上無其他玩家，無功而返',
          nextPhase: 'end_turn',
        }
      }
      const victim = others[Math.floor(Math.random() * others.length)]
      if (victim.children === 0) {
        return {
          playerUpdates: {},
          logMessage: `人口販運鎖定了 ${victim.name}，但他名下無一孩童，此次落空`,
          nextPhase: 'end_turn',
        }
      }
      return {
        playerUpdates: {},
        otherUpdates: [{ id: victim.id, children: Math.max(0, victim.children - 1) }],
        logMessage: `😱 人口販運！${victim.name} 痛失一個孩子，就此消失無蹤...`,
        nextPhase: 'end_turn',
      }
    }

    case 'plague': {
      const newChildren = Math.max(0, player.children - 1)
      return {
        playerUpdates: { children: newChildren },
        otherUpdates: others.map(p => ({ id: p.id, children: Math.max(0, p.children - 1) })),
        logMessage: '☠️ 瘟疫蔓延！所有玩家各失去一個孩子',
        nextPhase: 'end_turn',
      }
    }

    case 'all_gain_child':
      return {
        playerUpdates: { children: player.children + 1 },
        otherUpdates: others.map(p => ({ id: p.id, children: p.children + 1 })),
        logMessage: '🍼 嬰兒潮來襲！所有玩家各喜得一子',
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
    return { winnerId: null, childrenGained: 0, message: '平手！兩人棋逢敵手，無緣結果 😅' }
  }
  const winnerId = initiatorRoll > partnerRoll ? initiatorId : partnerId
  const childrenGained = winnerId === initiatorId && initiatorHasDouble ? 2 : 1
  return {
    winnerId,
    childrenGained,
    message: initiatorRoll > partnerRoll
      ? `發起者以 ${initiatorRoll} 對 ${partnerRoll} 勝出！`
      : `被選者以 ${partnerRoll} 對 ${initiatorRoll} 反制勝出！`,
  }
}

