'use client'
import { useState, useEffect, useRef } from 'react'
import { Player, GameState, GameLog } from '@/lib/types'
import { BOARD, WIN_CHILDREN, RANSOM_SECONDS, STEAL_COST, RANSOM_COST } from '@/lib/board-config'

const KEY_MOMENT_KEYWORDS = ['搶走', '瘟疫', '天降地契', '人口販運', '獲勝']

function Confetti() {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: ['#f59e0b','#ec4899','#22c55e','#3b82f6','#a855f7','#ef4444'][i % 6],
    delay: `${Math.random() * 2}s`,
    duration: `${2 + Math.random() * 2}s`,
    size: `${8 + Math.random() * 10}px`,
  }))
  return (
    <>
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece rounded-sm pointer-events-none"
          style={{
            left: p.left,
            top: '-20px',
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </>
  )
}

function DiceDisplay({ rolling, value }: { rolling: boolean; value?: number }) {
  const faces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
  if (rolling) {
    return (
      <div className="flex gap-2 justify-center my-2">
        <span className="text-3xl dice-rolling">🎲</span>
      </div>
    )
  }
  if (value) {
    return (
      <div className="flex gap-2 justify-center my-2">
        <span className="text-3xl">{faces[value]}</span>
        <span className="text-lg font-bold text-amber-700 self-center">= {value}</span>
      </div>
    )
  }
  return null
}

interface Props {
  state: GameState
  players: Player[]
  myId: string
  logs?: GameLog[]
  onAction: (action: string, data?: Record<string, unknown>) => Promise<void>
}

export default function ActionPanel({ state, players, myId, logs, onAction }: Props) {
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [diceRolling, setDiceRolling] = useState(false)
  const skipRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const me = players.find(p => p.id === myId)
  const currentPlayer = players.find(p => p.id === state.current_player_id)
  const isMyTurn = state.current_player_id === myId
  const pd = state.phase_data

  // Detect if current player might be offline (no state change in 60s)
  const [showSkip, setShowSkip] = useState(false)
  useEffect(() => {
    setShowSkip(false)
    if (skipRef.current) clearInterval(skipRef.current)
    if (!isMyTurn && (state.phase === 'rolling' || state.phase === 'end_turn')) {
      const t = setTimeout(() => setShowSkip(true), 60000)
      return () => clearTimeout(t)
    }
  }, [state.updated_at, isMyTurn, state.phase])

  // Ransom countdown
  useEffect(() => {
    if (state.phase !== 'steal_waiting' || !pd.ransom_deadline) return
    const update = () => {
      const secs = Math.max(0, Math.ceil((new Date(pd.ransom_deadline!).getTime() - Date.now()) / 1000))
      setCountdown(secs)
      if (secs === 0) {
        if (pd.thief_id === myId) {
          act('resolve_steal')
        }
      }
    }
    update()
    const t = setInterval(update, 500)
    return () => clearInterval(t)
  }, [state.phase, pd.ransom_deadline])

  async function act(action: string, data?: Record<string, unknown>) {
    if (action === 'roll') {
      setDiceRolling(true)
      await new Promise(r => setTimeout(r, 900))
    }
    setLoading(true)
    try { await onAction(action, data) } finally {
      setLoading(false)
      setDiceRolling(false)
    }
  }

  const btn = (label: string, action: string, data?: Record<string, unknown>, cls = '') => (
    <button
      key={action}
      onClick={() => act(action, data)}
      disabled={loading}
      className={`px-4 py-2 rounded-xl font-bold text-white transition disabled:opacity-40 ${cls || 'bg-amber-500 hover:bg-amber-600'}`}
    >
      {loading ? '...' : label}
    </button>
  )

  // ── FINISHED ──
  if (state.phase === 'finished') {
    const winner = players.find(p => p.id === pd.winner_id)
    const sorted = [...players].sort((a, b) => b.children - a.children)
    const keyMoments = (logs ?? []).filter(l =>
      KEY_MOMENT_KEYWORDS.some(kw => l.message.includes(kw))
    )
    return (
      <div className="bg-white rounded-2xl p-4 text-center shadow relative overflow-hidden">
        <Confetti />
        <div className="text-5xl mb-1">🏆</div>
        <div className="text-xl font-bold text-amber-700 mb-0.5">{winner?.name} 獲勝！</div>
        <div className="text-gray-500 text-sm mb-3">{winner?.children} 個孩子 🍼</div>
        <div className="text-left bg-amber-50 rounded-xl p-3 mb-3">
          <div className="text-xs font-bold text-amber-700 mb-2">最終排名</div>
          {sorted.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 py-1">
              <span className="text-sm w-5">{['🥇','🥈','🥉'][i] ?? `${i+1}.`}</span>
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="font-medium text-sm flex-1">{p.name}</span>
              <span className="text-sm text-gray-500">👶 {p.children}</span>
            </div>
          ))}
        </div>
        {keyMoments.length > 0 && (
          <div className="text-left bg-rose-50 rounded-xl p-3 mb-3">
            <div className="text-xs font-bold text-rose-700 mb-2">✨ 關鍵時刻</div>
            {keyMoments.map(l => (
              <div key={l.id} className="text-xs text-rose-600 py-0.5">{l.message}</div>
            ))}
          </div>
        )}
        <a
          href="/"
          className="inline-block w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-xl transition"
        >
          🏠 回到首頁
        </a>
      </div>
    )
  }

  // ── WAITING ──
  if (state.phase === 'waiting') {
    return <div className="bg-white rounded-2xl p-4 text-center text-gray-400 shadow">等待遊戲開始...</div>
  }

  // ── ROLLING ──
  if (state.phase === 'rolling') {
    if (!isMyTurn) {
      return (
        <div className="bg-white rounded-2xl p-4 text-center shadow">
          <p className="text-gray-500 mb-1">
            等待 <span className="font-bold" style={{ color: currentPlayer?.color }}>{currentPlayer?.name}</span> 擲骰...
          </p>
          {showSkip && (
            <div className="mt-2 p-2 bg-orange-50 rounded-xl border border-orange-200">
              <p className="text-xs text-orange-600 mb-2">玩家可能已離線</p>
              {btn('⏭ 跳過此玩家', 'end_turn', undefined, 'text-sm bg-orange-400 hover:bg-orange-500')}
            </div>
          )}
        </div>
      )
    }
    return (
      <div className="bg-white rounded-2xl p-4 shadow">
        <p className="text-center font-bold text-amber-700 mb-2">🎲 你的回合！</p>
        {diceRolling
          ? <DiceDisplay rolling={true} />
          : btn('🎲 擲骰子', 'roll', undefined, 'w-full bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 shadow-md')
        }
      </div>
    )
  }

  // ── BUY PROPERTY ──
  if (state.phase === 'buy_property') {
    const sq = BOARD[me?.position ?? 0]
    if (!isMyTurn) return <div className="bg-white rounded-2xl p-4 text-center text-gray-400 shadow">{currentPlayer?.name} 決定是否購買...</div>
    return (
      <div className="bg-white rounded-2xl p-4 shadow">
        <p className="font-bold text-center mb-1">{sq.name}</p>
        <p className="text-center text-gray-500 text-sm mb-3">售價 <span className="font-bold text-amber-700">${sq.price}</span>（你有 ${me?.money?.toLocaleString()}）</p>
        <div className="flex gap-2">
          {btn(`💰 購買 $${sq.price}`, 'buy_property', undefined, 'flex-1 bg-green-500 hover:bg-green-600')}
          {btn('⏭ 跳過', 'skip_buy', undefined, 'flex-1 bg-gray-400 hover:bg-gray-500')}
        </div>
      </div>
    )
  }

  // ── STEAL OPTION ──
  if (state.phase === 'steal_option') {
    const owner = players.find(p => p.id === pd.property_owner)
    if (!isMyTurn) return <div className="bg-white rounded-2xl p-4 text-center text-gray-400 shadow">{currentPlayer?.name} 考慮是否搶奪...</div>
    if (!owner || owner.children === 0) return <div className="bg-white rounded-2xl p-4 text-center text-gray-400 shadow">等待...</div>
    return (
      <div className="bg-white rounded-2xl p-4 shadow">
        <p className="font-bold text-center mb-1">😈 搶奪孩子？</p>
        <p className="text-gray-500 text-sm text-center mb-3">
          {owner.name} 有 {owner.children} 個孩子。<br />
          花費 ${STEAL_COST.toLocaleString()} 嘗試搶走一個（對方有 {RANSOM_SECONDS} 秒可贖回 ${RANSOM_COST.toLocaleString()}）
        </p>
        <div className="flex gap-2">
          {btn('😈 搶奪！', 'attempt_steal', undefined, 'flex-1 bg-red-500 hover:bg-red-600')}
          {btn('😇 算了', 'skip_steal', undefined, 'flex-1 bg-gray-400 hover:bg-gray-500')}
        </div>
      </div>
    )
  }

  // ── STEAL WAITING ──
  if (state.phase === 'steal_waiting') {
    const thief = players.find(p => p.id === pd.thief_id)
    const isVictim = pd.victim_id === myId
    return (
      <div className="bg-white rounded-2xl p-4 shadow text-center">
        <p className="font-bold text-red-600 mb-1">🚨 孩子被搶！</p>
        <p className="text-gray-500 text-sm mb-2">{thief?.name} 正在搶奪孩子！</p>
        <div className="text-2xl font-bold text-red-500 mb-3">{countdown}s</div>
        {isVictim ? (
          <>
            <p className="text-sm mb-3">支付 <span className="font-bold">${pd.ransom_cost}</span> 贖回孩子！</p>
            {btn(`💰 支付贖金 $${pd.ransom_cost}`, 'pay_ransom', undefined, 'w-full bg-blue-500 hover:bg-blue-600')}
          </>
        ) : (
          <p className="text-gray-400 text-sm">等待受害者回應...</p>
        )}
      </div>
    )
  }

  // ── DATE SELECT ──
  if (state.phase === 'date_select') {
    const others = players.filter(p => p.id !== state.current_player_id && !p.is_bankrupt)
    if (!isMyTurn) {
      return <div className="bg-white rounded-2xl p-4 text-center text-gray-400 shadow">{currentPlayer?.name} 正在選約會對象...</div>
    }
    return (
      <div className="bg-white rounded-2xl p-4 shadow">
        <p className="font-bold text-center text-pink-600 mb-1">💕 選擇約會對象</p>
        <p className="text-xs text-center text-gray-400 mb-3">雙方各付 $500，擲骰高者得孩子</p>
        <div className="flex flex-col gap-2">
          {others.map(p => (
            <button
              key={p.id}
              onClick={() => act('pick_date_partner', { partnerId: p.id })}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-pink-200 hover:border-pink-400 hover:bg-pink-50 transition"
            >
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="font-medium">{p.name}</span>
              <span className="ml-auto text-xs text-gray-400">💰${p.money.toLocaleString()} 👶{p.children}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── DATE ROLLING ──
  if (state.phase === 'date_rolling') {
    const initiator = players.find(p => p.id === pd.initiator_id)
    const partner = players.find(p => p.id === pd.partner_id)
    const myRollDone = (pd.initiator_id === myId && pd.initiator_roll !== undefined) ||
                       (pd.partner_id === myId && pd.partner_roll !== undefined)
    const inDate = pd.initiator_id === myId || pd.partner_id === myId

    return (
      <div className="bg-white rounded-2xl p-4 shadow text-center">
        <p className="font-bold text-pink-600 mb-2">💕 約會擲骰！</p>
        <div className="flex justify-around mb-3">
          <div>
            <div className="font-medium text-sm" style={{ color: initiator?.color }}>{initiator?.name}</div>
            <div className="text-xl">{pd.initiator_roll ?? '🎲'}</div>
          </div>
          <div className="text-xl self-center">VS</div>
          <div>
            <div className="font-medium text-sm" style={{ color: partner?.color }}>{partner?.name}</div>
            <div className="text-xl">{pd.partner_roll ?? '🎲'}</div>
          </div>
        </div>
        {inDate && !myRollDone && btn('🎲 擲骰！', 'date_roll', undefined, 'w-full bg-pink-500 hover:bg-pink-600')}
        {(!inDate || myRollDone) && <p className="text-gray-400 text-sm">等待對方擲骰...</p>}
      </div>
    )
  }

  // ── END TURN ──
  if (state.phase === 'end_turn') {
    if (!isMyTurn) return <div className="bg-white rounded-2xl p-4 text-center text-gray-400 shadow">等待 {currentPlayer?.name} 結束回合...</div>
    return (
      <div className="bg-white rounded-2xl p-4 shadow text-center">
        {btn('✅ 結束回合', 'end_turn', undefined, 'w-full bg-green-500 hover:bg-green-600')}
      </div>
    )
  }

  return null
}
