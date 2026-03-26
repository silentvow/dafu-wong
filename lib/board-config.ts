import { Square, CardEffect } from './types'

// 28 squares total (8×8 grid, border squares only)
// Bottom row L→R: 0-7 | Right col B→T: 8-13 | Top row R→L: 14-21 | Left col T→B: 22-27

export const BOARD: Square[] = [
  // ── Bottom row (left → right) ──
  { id: 0,  type: 'start',    name: '起點 🏁',       description: '每次經過領薪水（孩子越少越多）' },
  { id: 1,  type: 'property', name: '便利商店',        color: 'brown',    price: 1000, rent: [120,  300]  },
  { id: 2,  type: 'date',     name: '汽車旅館 💕',    description: '雙方各付 $500，擲骰高者得孩子' },
  { id: 3,  type: 'property', name: '早餐店',          color: 'brown',    price: 1200, rent: [150,  380]  },
  { id: 4,  type: 'party',    name: '多人派對 🎉',      description: '主辦人失去50%金錢，所有玩家擲骰，偶數者得孩子' },
  { id: 5,  type: 'property', name: '小吃攤',          color: 'lightblue', price: 1500, rent: [180,  480]  },
  { id: 6,  type: 'fate',     name: '命運 🎴',         description: '抽命運卡' },
  { id: 7,  type: 'work',     name: '工作 💼',         description: '收入依孩子數計算' },
  // ── Right column (bottom → top) ──
  { id: 8,  type: 'property', name: '夜市',            color: 'lightblue', price: 1800, rent: [220,  560]  },
  { id: 9,  type: 'hospital', name: '醫院 🏥',         description: '每個孩子繳 $500' },
  { id: 10, type: 'property', name: '電影院',          color: 'pink',     price: 2100, rent: [260,  660]  },
  { id: 11, type: 'chance',   name: '機會 📦',         description: '抽機會卡' },
  { id: 12, type: 'date',     name: '汽車旅館 💕',    description: '雙方各付 $500，擲骰高者得孩子' },
  { id: 13, type: 'property', name: '補習班',          color: 'pink',     price: 2500, rent: [310,  780]  },
  // ── Top row (right → left) ──
  { id: 14, type: 'paternity', name: '親子鑑定 🧬',      description: '花費 $2,000 指定有孩子的玩家，擲骰比大小，點數嚴格較大者搶走對方一個孩子' },
  { id: 15, type: 'property', name: '百貨公司',        color: 'yellow',   price: 2800, rent: [350,  880]  },
  { id: 16, type: 'party',    name: '多人派對 🎉',      description: '主辦人失去50%金錢，所有玩家擲骰，偶數者得孩子' },
  { id: 17, type: 'property', name: '購物中心',        color: 'yellow',   price: 3200, rent: [400, 1000]  },
  { id: 18, type: 'date',     name: '汽車旅館 💕',    description: '雙方各付 $500，擲骰高者得孩子' },
  { id: 19, type: 'fate',     name: '命運 🎴',         description: '抽命運卡' },
  { id: 20, type: 'property', name: '豪宅',            color: 'green',    price: 3000, rent: [440, 1100]  },
  { id: 21, type: 'work',     name: '工作 💼',         description: '收入依孩子數計算' },
  // ── Left column (top → bottom) ──
  { id: 22, type: 'property', name: '金融中心',        color: 'green',    price: 3200, rent: [480, 1200]  },
  { id: 23, type: 'chance',   name: '機會 📦',         description: '抽機會卡' },
  { id: 24, type: 'date',     name: '汽車旅館 💕',    description: '雙方各付 $500，擲骰高者得孩子' },
  { id: 25, type: 'hospital', name: '醫院 🏥',         description: '每個孩子繳 $500' },
  { id: 26, type: 'property', name: '科技園區',        color: 'green',    price: 3500, rent: [500, 1250]  },
  { id: 27, type: 'paternity', name: '親子鑑定 🧬',      description: '花費 $2,000 指定有孩子的玩家，擲骰比大小，點數嚴格較大者搶走對方一個孩子' },
]

// Color groups — owning all properties in a group gives full rent (rent[1])
export const COLOR_GROUPS: Record<string, number[]> = {
  brown:    [1, 3],
  lightblue:[5, 8],
  pink:     [10, 13],
  yellow:   [15, 17],
  green:    [20, 22, 26],
}

export const TOTAL_SQUARES   = 28
export const WIN_CHILDREN    = 5
export const STARTING_MONEY  = 15000
// Base income values — calibrated for a player with 5 children.
// Each missing child adds a bonus (孩子越少，收入越多).
export const SALARY          = 2000   // base pass-start salary (at 5 children)
export const SALARY_CHILD_BONUS = 600 // extra per child below WIN_CHILDREN
export const WORK_BONUS      = 500    // base work income (at 5 children)
export const WORK_CHILD_BONUS = 200   // extra per child below WIN_CHILDREN
export const TAX_AMOUNT      = 500
export const HOSPITAL_PER_CHILD = 500
export const DATE_FEE        = 1000
export const PATERNITY_COST  = 2000

/** Salary received when passing/returning to start, scaled by children count */
export function calcSalary(children: number): number {
  return SALARY + Math.max(0, WIN_CHILDREN - children) * SALARY_CHILD_BONUS
}

/** Work income, scaled by children count */
export function calcWorkBonus(children: number): number {
  return WORK_BONUS + Math.max(0, WIN_CHILDREN - children) * WORK_CHILD_BONUS
}

// ── Card decks ──
export interface GameCard {
  id: number
  text: string
  effect: CardEffect
}

export const CHANCE_CARDS: GameCard[] = [
  { id: 1, text: '天降地契！獲得一塊隨機地產',            effect: { type: 'gain_property_random' } },
  { id: 2, text: '領養孩子！花 $1,000 領養一個孩子',      effect: { type: 'adopt_child', cost: 1000 } },
  { id: 3, text: '孩子生日！向所有玩家收取隨機禮金',       effect: { type: 'collect_from_all_random', min: 200, max: 900 } },
  { id: 4, text: '一夜情！前進到最近的汽車旅館',           effect: { type: 'move_to_date' } },
  { id: 5, text: '育兒補助！獲得 $500–$3,000',            effect: { type: 'receive', min: 500, max: 3000 } },
  { id: 6, text: '孩子出國留學，花費 $1,000–$4,000',       effect: { type: 'pay', min: 1000, max: 4000 } },
  { id: 7, text: '收紅包！每個孩子得 $100–$1,000',         effect: { type: 'receive_per_child', min: 100, max: 1000 } },
  { id: 8, text: '回到起點（領薪水）🏁',                   effect: { type: 'move_to_start' } },
]

export const FATE_CARDS: GameCard[] = [
  { id: 1, text: '人口販運！隨機一名玩家失去一個孩子',     effect: { type: 'steal_child_random' } },
  { id: 2, text: '天災！你的隨機一塊地產變回無主',         effect: { type: 'lose_property_random' } },
  { id: 3, text: '瘟疫！所有玩家（含你）各失去一個孩子',   effect: { type: 'plague' } },
  { id: 4, text: '破財消災！向所有玩家各付隨機金額',        effect: { type: 'pay_all_random', min: 200, max: 900 } },
  { id: 5, text: '孩子叛逆離家出走！失去一個孩子',          effect: { type: 'lose_child', amount: 1 } },
  { id: 6, text: '孩子生病！每個孩子花費 $200–$900',        effect: { type: 'pay_per_child', min: 200, max: 900 } },
  { id: 7, text: '孩子被領養！失去一個孩子得 $2,000',       effect: { type: 'sell_child', amount: 2000 } },
  { id: 8, text: '孩子拿獎學金！得 $1,000–$5,000',          effect: { type: 'receive', min: 1000, max: 5000 } },
]

// Returns the grid position (1-indexed, 8×8) for a given square id
export function getGridPos(id: number): { row: number; col: number } {
  if (id === 0)  return { row: 8, col: 1 }              // START bottom-left
  if (id <= 6)   return { row: 8, col: id + 1 }         // bottom row L→R (cols 2-7)
  if (id === 7)  return { row: 8, col: 8 }              // WORK bottom-right
  if (id <= 13)  return { row: 8 - (id - 7), col: 8 }  // right col B→T (rows 7-2)
  if (id === 14) return { row: 1, col: 8 }              // WORK top-right
  if (id <= 20)  return { row: 1, col: 8 - (id - 14) } // top row R→L (cols 7-2)
  if (id === 21) return { row: 1, col: 1 }              // WORK top-left
  return { row: id - 20, col: 1 }                       // left col T→B (rows 2-7)
}

export const PLAYER_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
]
