export type SquareType =
  | 'start'
  | 'property'
  | 'date'
  | 'chance'
  | 'fate'
  | 'hospital'
  | 'tax'
  | 'work'
  | 'party'

export interface Square {
  id: number
  type: SquareType
  name: string
  color?: string
  price?: number
  rent?: number[]
  description?: string
}

export interface Player {
  id: string
  room_id: string
  name: string
  color: string
  turn_order: number
  position: number
  money: number
  children: number
  is_bankrupt: boolean
  next_date_double: boolean
}

export type GamePhase =
  | 'waiting'
  | 'rolling'
  | 'buy_property'
  | 'steal_option'
  | 'steal_rolling'
  | 'date_select'
  | 'date_rolling'
  | 'party_rolling'
  | 'end_turn'
  | 'finished'

export interface PhaseData {
  dice?: number
  landed_square?: number

  // property
  property_owner?: string | null
  rent_amount?: number

  // steal
  thief_id?: string
  victim_id?: string
  thief_roll?: number
  victim_roll?: number

  // date
  initiator_id?: string
  partner_id?: string
  initiator_roll?: number
  partner_roll?: number

  // card
  card_text?: string
  card_effect?: CardEffect

  // party
  host_id?: string
  party_rolls?: Record<string, number>

  // winner
  winner_id?: string
}

export type CardEffect =
  | { type: 'gain_child'; amount: number }
  | { type: 'lose_child'; amount: number }
  | { type: 'pay'; amount?: number; min?: number; max?: number }
  | { type: 'receive'; amount?: number; min?: number; max?: number }
  | { type: 'receive_per_child'; min: number; max: number }
  | { type: 'pay_per_child'; min: number; max: number }
  | { type: 'collect_from_all_random'; min: number; max: number }
  | { type: 'pay_all_random'; min: number; max: number }
  | { type: 'sell_child'; amount: number }
  | { type: 'adopt_child'; cost: number }
  | { type: 'go_to_jail' }
  | { type: 'move_to_start' }
  | { type: 'move_to_date' }
  | { type: 'next_date_double' }
  | { type: 'steal_random'; amount: number }
  | { type: 'gain_property_random' }
  | { type: 'lose_property_random' }
  | { type: 'steal_child_random' }
  | { type: 'plague' }
  | { type: 'all_gain_child' }

export interface PropertyState {
  owner_id: string
  houses: number
}

export interface GameState {
  room_id: string
  current_player_id: string | null
  turn_number: number
  phase: GamePhase
  phase_data: PhaseData
  properties: Record<string, PropertyState>
  updated_at: string
}

export interface Room {
  id: string
  status: 'waiting' | 'playing' | 'finished'
  winner_id: string | null
  created_at: string
}

export interface GameLog {
  id: number
  room_id: string
  message: string
  created_at: string
}
