'use client'
import { Player, GameState } from '@/lib/types'
import { WIN_CHILDREN } from '@/lib/board-config'

interface Props {
  players: Player[]
  state: GameState
  myId: string
}

export default function PlayerPanel({ players, state, myId }: Props) {
  const sorted = [...players].sort((a, b) => a.turn_order - b.turn_order)

  return (
    <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-2">
      <h2 className="font-bold text-gray-700 text-sm mb-1">玩家狀態</h2>
      {sorted.map(p => {
        const isCurrent = p.id === state.current_player_id
        const isMe = p.id === myId
        return (
          <div
            key={p.id}
            className={`rounded-xl p-3 border-2 transition ${
              isCurrent ? 'border-amber-400 bg-amber-50' : 'border-gray-100 bg-gray-50'
            } ${p.is_bankrupt ? 'opacity-40' : ''}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: p.color }}
              >
                {p.name[0]}
              </div>
              <span className="font-bold text-sm">{p.name}</span>
              {isMe && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 rounded-full ml-auto">你</span>}
              {isCurrent && !isMe && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 rounded-full ml-auto">回合中</span>}
              {p.is_bankrupt && <span className="text-xs bg-red-100 text-red-600 px-1.5 rounded-full ml-auto">破產</span>}
            </div>
            <div className="flex gap-3 text-xs text-gray-600">
              <span>💰 ${p.money.toLocaleString()}</span>
              <span>
                👶 {p.children}/{WIN_CHILDREN}
                {p.children > 0 && ' ' + '🍼'.repeat(Math.min(p.children, 5))}
              </span>
              {p.next_date_double && <span>💕×2</span>}
            </div>
            {/* Progress bar for children */}
            <div className="mt-1.5 bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-pink-400 rounded-full h-1.5 transition-all"
                style={{ width: `${(p.children / WIN_CHILDREN) * 100}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
