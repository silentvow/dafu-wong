import { describe, it, expect } from 'vitest'
import { calcRent, movePlayer, resolveDateRoll, checkWin, nextPlayerIndex } from './game-engine'
import { Player, PropertyState } from './types'
import { TOTAL_SQUARES, WIN_CHILDREN } from './board-config'

// Minimal player factory
function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    room_id: 'r1',
    name: 'Test',
    color: '#ff0000',
    turn_order: 0,
    position: 0,
    money: 10000,
    children: 0,
    is_bankrupt: false,
    next_date_double: false,
    ...overrides,
  }
}

// ── calcRent ──────────────────────────────────────────────────────────────────

describe('calcRent', () => {
  const singleOwned: Record<string, PropertyState> = {
    1: { owner_id: 'p1', houses: 0 }, // 便利商店 (brown), rent: [120, 300]
  }
  const bothBrownOwned: Record<string, PropertyState> = {
    1: { owner_id: 'p1', houses: 0 },
    3: { owner_id: 'p1', houses: 0 }, // 早餐店 also brown
  }

  it('returns base rent when owner does not own full color group', () => {
    expect(calcRent(1, singleOwned)).toBe(120)
  })

  it('returns doubled rent when owner holds full color group', () => {
    expect(calcRent(1, bothBrownOwned)).toBe(300)
  })

  it('returns 0 for unowned property', () => {
    expect(calcRent(1, {})).toBe(0)
  })

  it('returns 0 for non-property squares', () => {
    // Square 0 is 'start' with no rent
    expect(calcRent(0, {})).toBe(0)
  })
})

// ── movePlayer ────────────────────────────────────────────────────────────────

describe('movePlayer', () => {
  it('advances position by steps', () => {
    const p = makePlayer({ position: 5 })
    const { newPosition, passedStart } = movePlayer(p, 3)
    expect(newPosition).toBe(8)
    expect(passedStart).toBe(false)
  })

  it('wraps around the board and flags passedStart', () => {
    const p = makePlayer({ position: 26 })
    const { newPosition, passedStart } = movePlayer(p, 4)
    expect(newPosition).toBe((26 + 4) % TOTAL_SQUARES)
    expect(passedStart).toBe(true)
  })

  it('landing exactly on start counts as passing start', () => {
    const p = makePlayer({ position: TOTAL_SQUARES - 2 })
    const { newPosition, passedStart } = movePlayer(p, 2)
    expect(newPosition).toBe(0)
    expect(passedStart).toBe(true)
  })

  it('does not flag passedStart for normal move', () => {
    const p = makePlayer({ position: 0 })
    const { newPosition, passedStart } = movePlayer(p, 1)
    expect(newPosition).toBe(1)
    expect(passedStart).toBe(false)
  })
})

// ── resolveDateRoll ───────────────────────────────────────────────────────────

describe('resolveDateRoll', () => {
  it('tie returns no winner', () => {
    const r = resolveDateRoll(3, 3, 'a', 'b', false)
    expect(r.winnerId).toBeNull()
    expect(r.childrenGained).toBe(0)
  })

  it('initiator wins when roll is higher', () => {
    const r = resolveDateRoll(5, 2, 'a', 'b', false)
    expect(r.winnerId).toBe('a')
    expect(r.childrenGained).toBe(1)
  })

  it('partner wins when roll is higher', () => {
    const r = resolveDateRoll(2, 5, 'a', 'b', false)
    expect(r.winnerId).toBe('b')
    expect(r.childrenGained).toBe(1)
  })

  it('initiator with double bonus gains 2 children on win', () => {
    const r = resolveDateRoll(5, 2, 'a', 'b', true)
    expect(r.winnerId).toBe('a')
    expect(r.childrenGained).toBe(2)
  })

  it('double bonus does NOT apply when partner wins', () => {
    const r = resolveDateRoll(2, 5, 'a', 'b', true)
    expect(r.winnerId).toBe('b')
    expect(r.childrenGained).toBe(1)
  })
})

// ── checkWin ──────────────────────────────────────────────────────────────────

describe('checkWin', () => {
  it('returns null when no player has reached WIN_CHILDREN', () => {
    const players = [makePlayer({ children: WIN_CHILDREN - 1 })]
    expect(checkWin(players)).toBeNull()
  })

  it('returns the winning player', () => {
    const winner = makePlayer({ id: 'winner', children: WIN_CHILDREN })
    const loser = makePlayer({ id: 'loser', children: 1 })
    expect(checkWin([loser, winner])?.id).toBe('winner')
  })

  it('returns first winner when multiple players qualify', () => {
    const w1 = makePlayer({ id: 'w1', children: WIN_CHILDREN })
    const w2 = makePlayer({ id: 'w2', children: WIN_CHILDREN + 1 })
    // find returns first match in array order
    expect(checkWin([w1, w2])?.id).toBe('w1')
  })
})

// ── nextPlayerIndex ───────────────────────────────────────────────────────────

describe('nextPlayerIndex', () => {
  const players = [
    makePlayer({ id: 'p0', turn_order: 0 }),
    makePlayer({ id: 'p1', turn_order: 1 }),
    makePlayer({ id: 'p2', turn_order: 2 }),
  ]

  it('advances to the next player in turn order', () => {
    expect(nextPlayerIndex(players, 'p0')).toBe('p1')
    expect(nextPlayerIndex(players, 'p1')).toBe('p2')
  })

  it('wraps back to the first player after the last', () => {
    expect(nextPlayerIndex(players, 'p2')).toBe('p0')
  })

  it('skips bankrupt players', () => {
    const withBankrupt = [
      makePlayer({ id: 'p0', turn_order: 0 }),
      makePlayer({ id: 'p1', turn_order: 1, is_bankrupt: true }),
      makePlayer({ id: 'p2', turn_order: 2 }),
    ]
    expect(nextPlayerIndex(withBankrupt, 'p0')).toBe('p2')
  })

  it('stays on current player when everyone else is bankrupt', () => {
    const solo = [
      makePlayer({ id: 'p0', turn_order: 0 }),
      makePlayer({ id: 'p1', turn_order: 1, is_bankrupt: true }),
    ]
    expect(nextPlayerIndex(solo, 'p0')).toBe('p0')
  })
})
