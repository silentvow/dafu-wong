'use client'
import { BOARD, getGridPos, COLOR_GROUPS } from '@/lib/board-config'
import { Player, GameState } from '@/lib/types'

const SQUARE_COLORS: Record<string, string> = {
  brown:    '#92400e',
  lightblue:'#0891b2',
  pink:     '#db2777',
  yellow:   '#d97706',
  green:    '#16a34a',
}

const SQUARE_BG: Record<string, string> = {
  start:    'bg-green-100',
  tax:      'bg-purple-100',
  work:     'bg-sky-100',
  hospital: 'bg-red-50',
  date:     'bg-pink-100',
  chance:   'bg-orange-100',
  fate:     'bg-indigo-100',
  property: 'bg-white',
}

interface BoardProps {
  players: Player[]
  state: GameState
  myId: string
}

const CELL = 60 // px per cell
const BOARD_SIZE = CELL * 8 // 480px

export default function Board({ players, state, myId }: BoardProps) {
  return (
    <div
      className="relative rounded-xl overflow-hidden flex-shrink-0"
      style={{
        width: BOARD_SIZE,
        height: BOARD_SIZE,
        border: '3px solid var(--border)',
        boxShadow: '0 4px 20px rgba(180,130,0,0.25)',
        background: 'var(--bg-board)',
      }}
    >
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(8, ${CELL}px)`,
          gridTemplateRows: `repeat(8, ${CELL}px)`,
        }}
      >
        {BOARD.map(sq => {
          const { row, col } = getGridPos(sq.id)
          const prop = state.properties[sq.id]
          const owner = prop ? players.find(p => p.id === prop.owner_id) : null
          const squareBg = SQUARE_BG[sq.type] ?? 'bg-white'
          const isCurrentSquare = players.some(p => p.position === sq.id && p.id === state.current_player_id)

          return (
            <div
              key={sq.id}
              className={`board-square ${squareBg} border border-amber-200/60 flex flex-col items-center justify-center text-center relative overflow-hidden cursor-default select-none ${isCurrentSquare ? 'ring-2 ring-amber-500 ring-inset z-10' : ''}`}
              style={{ gridRow: row, gridColumn: col, minWidth: 0 }}
              title={`${sq.name}${sq.description ? ' — ' + sq.description : ''}${sq.price ? ' $' + sq.price : ''}`}
            >
              {sq.color && (
                <div
                  className="absolute top-0 left-0 right-0 h-2"
                  style={{ backgroundColor: SQUARE_COLORS[sq.color] ?? '#999' }}
                />
              )}
              {owner && (
                <div
                  className="absolute top-2 right-1 w-2.5 h-2.5 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: owner.color }}
                  title={`${owner.name} 的物業`}
                />
              )}
              <span className="text-[10px] leading-tight font-semibold text-gray-800 px-0.5 mt-1 truncate w-full text-center">
                {sq.name.replace(/ .+$/, '').slice(0, 5)}
              </span>
              {sq.price && (
                <span className="text-[9px] text-amber-700 font-medium">${sq.price}</span>
              )}
            </div>
          )
        })}

        {/* Center area */}
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{
            gridRow: '2 / 8',
            gridColumn: '2 / 8',
            background: 'radial-gradient(ellipse at center, #fef3c7 0%, #fde68a 100%)',
            borderRadius: 8,
            margin: 2,
          }}
        >
          <div className="text-4xl mb-1">🤰</div>
          <div className="text-base font-bold text-amber-800">大腹翁</div>
          <div className="text-[11px] text-amber-600 mt-1">先得 5 個孩子獲勝</div>
          <div className="mt-2 bg-amber-800/10 rounded-full px-3 py-0.5 text-[11px] text-amber-800 font-semibold">
            回合 #{state.turn_number}
          </div>
        </div>
      </div>

      {/* Player tokens */}
      {players.filter(p => !p.is_bankrupt).map(player => {
        const { row, col } = getGridPos(player.position)
        const sameSquare = players.filter(p2 => p2.position === player.position && !p2.is_bankrupt)
        const idx = sameSquare.findIndex(p2 => p2.id === player.id)
        const offsetX = (idx % 2) * 16 - 8
        const offsetY = idx >= 2 ? 14 : -14

        return (
          <div
            key={player.id}
            className="absolute flex items-center justify-center rounded-full text-white text-[10px] font-bold transition-all duration-500 border-2 border-white"
            style={{
              width: 24,
              height: 24,
              backgroundColor: player.color,
              boxShadow: player.id === myId
                ? `0 0 0 2px white, 0 0 0 4px ${player.color}`
                : '0 2px 6px rgba(0,0,0,0.35)',
              left: (col - 1) * CELL + (CELL / 2 - 12) + offsetX,
              top:  (row - 1) * CELL + (CELL / 2 - 12) + offsetY,
              zIndex: player.id === myId ? 10 : 5,
            }}
            title={player.name}
          >
            {player.name[0]}
          </div>
        )
      })}
    </div>
  )
}
