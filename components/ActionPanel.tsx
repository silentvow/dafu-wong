'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Player, GameState, GameLog } from '@/lib/types'
import { BOARD, WIN_CHILDREN, PATERNITY_COST, DATE_FEE } from '@/lib/board-config'

const KEY_MOMENT_KEYWORDS = ['搶走', '瘟疫', '天降地契', '人口販運', '獲勝']
const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

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
        <span className="text-3xl">{DICE_FACES[value]}</span>
        <span className="text-lg font-bold text-amber-700 self-center">= {value}</span>
      </div>
    )
  }
  return null
}

// Banner shown after rolling: dice result + destination square
function DiceBanner({ dice, squareName }: { dice: number; squareName: string }) {
  return (
    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
      <span className="text-3xl leading-none">{DICE_FACES[dice]}</span>
      <div className="min-w-0">
        <div className="text-xs text-amber-600">擲出 {dice} 點</div>
        <div className="font-bold text-amber-800 text-sm truncate">→ {squareName}</div>
      </div>
    </div>
  )
}

// Compact recap of current-turn log entries
function TurnRecap({ logs }: { logs: GameLog[] }) {
  if (logs.length === 0) return null
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3">
      <div className="text-xs font-bold text-gray-500 mb-1.5">📋 本回合</div>
      <div className="flex flex-col gap-0.5">
        {logs.map(l => (
          <p key={l.id} className="text-xs text-gray-600 leading-relaxed">{l.message}</p>
        ))}
      </div>
    </div>
  )
}

// VS dice panel for steal/date rolling — shows both players' rolls prominently
function VsPanel({
  leftLabel,
  leftColor,
  leftRoll,
  rightLabel,
  rightColor,
  rightRoll,
  leftTag,
  rightTag,
  accentColor,
}: {
  leftLabel: string
  leftColor?: string
  leftRoll?: number
  rightLabel: string
  rightColor?: string
  rightRoll?: number
  leftTag?: string
  rightTag?: string
  accentColor: string
}) {
  const bothRolled = leftRoll !== undefined && rightRoll !== undefined
  const leftWins = bothRolled && leftRoll! > rightRoll!
  const rightWins = bothRolled && rightRoll! > leftRoll!

  return (
    <div className="flex items-stretch gap-2 mb-3">
      {/* Left */}
      <div className={`flex-1 rounded-xl p-3 text-center border-2 transition ${leftWins ? 'border-green-400 bg-green-50' : rightWins ? 'border-gray-200 bg-gray-50 opacity-70' : 'border-gray-200 bg-gray-50'}`}>
        <div className="text-xs font-medium mb-1 truncate" style={{ color: leftColor }}>{leftLabel}</div>
        {leftTag && <div className={`text-xs mb-1 ${accentColor === 'red' ? 'text-red-500' : 'text-pink-500'}`}>{leftTag}</div>}
        <div className="text-4xl font-bold text-gray-800 leading-none my-1">
          {leftRoll !== undefined ? DICE_FACES[leftRoll] : '🎲'}
        </div>
        {leftRoll !== undefined && (
          <div className="text-lg font-bold text-gray-700">{leftRoll}</div>
        )}
        {leftWins && <div className="text-xs text-green-600 font-bold mt-1">✓ 勝</div>}
      </div>

      {/* VS */}
      <div className="flex items-center justify-center px-1">
        <span className="text-sm font-bold text-gray-400">VS</span>
      </div>

      {/* Right */}
      <div className={`flex-1 rounded-xl p-3 text-center border-2 transition ${rightWins ? 'border-green-400 bg-green-50' : leftWins ? 'border-gray-200 bg-gray-50 opacity-70' : 'border-gray-200 bg-gray-50'}`}>
        <div className="text-xs font-medium mb-1 truncate" style={{ color: rightColor }}>{rightLabel}</div>
        {rightTag && <div className="text-xs mb-1 text-gray-400">{rightTag}</div>}
        <div className="text-4xl font-bold text-gray-800 leading-none my-1">
          {rightRoll !== undefined ? DICE_FACES[rightRoll] : '🎲'}
        </div>
        {rightRoll !== undefined && (
          <div className="text-lg font-bold text-gray-700">{rightRoll}</div>
        )}
        {rightWins && <div className="text-xs text-green-600 font-bold mt-1">✓ 勝</div>}
      </div>
    </div>
  )
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
  const [diceRolling, setDiceRolling] = useState(false)
  const skipRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const me = players.find(p => p.id === myId)
  const currentPlayer = players.find(p => p.id === state.current_player_id)
  const isMyTurn = state.current_player_id === myId
  const pd = state.phase_data

  // Logs belonging to the current turn (after the last "輪到 X 了" separator)
  const turnLogs = useMemo(() => {
    const allLogs = logs ?? []
    if (allLogs.length === 0) return []
    let startIdx = 0
    for (let i = allLogs.length - 1; i >= 0; i--) {
      if (allLogs[i].message.includes('出手了')) {
        startIdx = i + 1
        break
      }
    }
    return allLogs.slice(startIdx)
  }, [logs])

  // Detect if current player might be offline
  const [showSkip, setShowSkip] = useState(false)
  useEffect(() => {
    setShowSkip(false)
    if (skipRef.current) clearInterval(skipRef.current)
    if (!isMyTurn && (state.phase === 'rolling' || state.phase === 'end_turn')) {
      const t = setTimeout(() => setShowSkip(true), 60000)
      return () => clearTimeout(t)
    }
  }, [state.updated_at, isMyTurn, state.phase])

  async function act(action: string, data?: Record<string, unknown>) {
    if (action === 'roll' || action === 'party_roll' || action === 'paternity_roll') {
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
    const diceResult = pd.dice as number | undefined
    const squareName = BOARD[currentPlayer?.position ?? me?.position ?? 0]?.name ?? ''
    if (!isMyTurn) {
      return (
        <div className="bg-white rounded-2xl p-4 shadow">
          {diceResult && <DiceBanner dice={diceResult} squareName={squareName} />}
          <div className="text-center text-gray-400 text-sm">{currentPlayer?.name} 決定是否購買...</div>
        </div>
      )
    }
    const sq = BOARD[me?.position ?? 0]
    const canAfford = (me?.money ?? 0) >= (sq.price ?? 0)
    return (
      <div className="bg-white rounded-2xl p-4 shadow">
        {diceResult && <DiceBanner dice={diceResult} squareName={squareName} />}
        <p className="font-bold text-center mb-1">{sq.name}</p>
        <p className="text-center text-gray-500 text-sm mb-3">
          售價 <span className="font-bold text-amber-700">${sq.price}</span>（你有 ${me?.money?.toLocaleString()}）
        </p>
        {!canAfford && <p className="text-center text-red-500 text-xs mb-2">💸 金錢不足，無法購買</p>}
        <div className="flex gap-2">
          <button
            onClick={() => act('buy_property')}
            disabled={loading || !canAfford}
            className="flex-1 px-4 py-2 rounded-xl font-bold text-white transition disabled:opacity-40 bg-green-500 hover:bg-green-600"
          >
            {loading ? '...' : `💰 購買 $${sq.price}`}
          </button>
          {btn('⏭ 跳過', 'skip_buy', undefined, 'flex-1 bg-gray-400 hover:bg-gray-500')}
        </div>
      </div>
    )
  }

  // ── PATERNITY SELECT ──
  if (state.phase === 'paternity_select') {
    const targets = players.filter(p => p.id !== state.current_player_id && !p.is_bankrupt && p.children > 0)

    if (!isMyTurn) {
      return (
        <div className="bg-white rounded-2xl p-4 shadow">
          <div className="text-center text-gray-400 text-sm">{currentPlayer?.name} 正在選擇親子鑑定目標...</div>
        </div>
      )
    }
    const canAfford = (me?.money ?? 0) >= PATERNITY_COST
    return (
      <div className="bg-white rounded-2xl p-4 shadow">
        <p className="font-bold text-center text-teal-700 mb-1">🧬 親子鑑定</p>
        <p className="text-xs text-center text-gray-400 mb-3">
          花費 ${PATERNITY_COST.toLocaleString()}，指定目標，擲骰嚴格較大者搶走對方一個孩子
        </p>
        {!canAfford && <p className="text-center text-red-500 text-xs mb-2">💸 金錢不足（需 ${PATERNITY_COST}）</p>}
        <div className="flex flex-col gap-2">
          {targets.map(p => (
            <button
              key={p.id}
              onClick={() => act('pick_paternity_target', { targetId: p.id })}
              disabled={loading || !canAfford}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-teal-200 hover:border-teal-400 hover:bg-teal-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="font-medium">{p.name}</span>
              <span className="ml-auto text-xs text-gray-400">👶{p.children}</span>
            </button>
          ))}
          {btn('🚪 放棄', 'skip_paternity', undefined, 'mt-1 bg-gray-400 hover:bg-gray-500 text-sm')}
        </div>
      </div>
    )
  }

  // ── PATERNITY ROLLING ──
  if (state.phase === 'paternity_rolling') {
    const attacker = players.find(p => p.id === pd.attacker_id)
    const target = players.find(p => p.id === pd.target_id)
    const isAttacker = pd.attacker_id === myId
    const isTarget = pd.target_id === myId
    const inPaternity = isAttacker || isTarget
    const myRollDone = (isAttacker && pd.attacker_roll !== undefined) || (isTarget && pd.target_roll !== undefined)
    const bothRolled = pd.attacker_roll !== undefined && pd.target_roll !== undefined
    const attackerWins = bothRolled && (pd.attacker_roll as number) > (pd.target_roll as number)

    return (
      <div className="bg-white rounded-2xl p-4 shadow">
        <p className="font-bold text-teal-700 text-center mb-3">🧬 親子鑑定擲骰！</p>
        <VsPanel
          leftLabel={attacker?.name ?? ''}
          leftColor={attacker?.color}
          leftRoll={pd.attacker_roll as number | undefined}
          leftTag="搶方"
          rightLabel={target?.name ?? ''}
          rightColor={target?.color}
          rightRoll={pd.target_roll as number | undefined}
          rightTag="守方"
          accentColor="red"
        />
        {bothRolled && (
          <p className={`text-center font-bold text-sm mb-3 ${attackerWins ? 'text-teal-700' : 'text-gray-600'}`}>
            {attackerWins ? `🧬 ${attacker?.name} 親子鑑定成功！` : `😅 ${attacker?.name} 鑑定失敗！`}
          </p>
        )}
        {inPaternity && !myRollDone && (
          diceRolling
            ? <DiceDisplay rolling={true} />
            : btn('🎲 擲骰！', 'paternity_roll', undefined, 'w-full bg-teal-500 hover:bg-teal-600')
        )}
        {(!inPaternity || myRollDone) && !bothRolled && <p className="text-gray-400 text-sm text-center">等待對方擲骰...</p>}
        {bothRolled && !inPaternity && <p className="text-gray-400 text-sm text-center">結算中...</p>}
      </div>
    )
  }

  // ── DATE SELECT ──
  if (state.phase === 'date_select') {
    const others = players.filter(p => p.id !== state.current_player_id && !p.is_bankrupt)
    const diceResult = pd.dice as number | undefined

    if (!isMyTurn) {
      return (
        <div className="bg-white rounded-2xl p-4 shadow">
          {diceResult && <DiceBanner dice={diceResult} squareName="汽車旅館" />}
          <div className="text-center text-gray-400 text-sm">{currentPlayer?.name} 正在選約會對象...</div>
        </div>
      )
    }
    const myMoney = me?.money ?? 0
    const canAffordDate = myMoney >= DATE_FEE
    return (
      <div className="bg-white rounded-2xl p-4 shadow">
        {diceResult && <DiceBanner dice={diceResult} squareName="汽車旅館 💕" />}
        <p className="font-bold text-center text-pink-600 mb-1">💕 選擇約會對象</p>
        <p className="text-xs text-center text-gray-400 mb-3">發起者付 ${DATE_FEE}，擲骰高者得孩子</p>
        {!canAffordDate && <p className="text-center text-red-500 text-xs mb-2">💸 金錢不足（需 ${DATE_FEE}），無法約會</p>}
        <div className="flex flex-col gap-2">
          {others.map(p => {
            const disabled = loading || !canAffordDate
            return (
              <button
                key={p.id}
                onClick={() => act('pick_date_partner', { partnerId: p.id })}
                disabled={disabled}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-pink-200 hover:border-pink-400 hover:bg-pink-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="font-medium">{p.name}</span>
                <span className="ml-auto text-xs text-gray-400">💰${p.money.toLocaleString()} 👶{p.children}</span>
              </button>
            )
          })}
          {btn('💔 放棄配對', 'skip_date', undefined, 'mt-1 bg-gray-400 hover:bg-gray-500 text-sm')}
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
    const bothRolled = pd.initiator_roll !== undefined && pd.partner_roll !== undefined
    const initiatorWins = bothRolled && (pd.initiator_roll as number) >= (pd.partner_roll as number)

    return (
      <div className="bg-white rounded-2xl p-4 shadow">
        <p className="font-bold text-pink-600 text-center mb-3">💕 約會擲骰！</p>
        <VsPanel
          leftLabel={initiator?.name ?? ''}
          leftColor={initiator?.color}
          leftRoll={pd.initiator_roll as number | undefined}
          rightLabel={partner?.name ?? ''}
          rightColor={partner?.color}
          rightRoll={pd.partner_roll as number | undefined}
          accentColor="pink"
        />
        {bothRolled && (
          <p className="text-center font-bold text-sm text-pink-600 mb-3">
            {initiatorWins
              ? `💕 ${initiator?.name} 得到孩子！`
              : `💕 ${partner?.name} 得到孩子！`}
          </p>
        )}
        {inDate && !myRollDone && btn('🎲 擲骰！', 'date_roll', undefined, 'w-full bg-pink-500 hover:bg-pink-600')}
        {(!inDate || myRollDone) && !bothRolled && <p className="text-gray-400 text-sm text-center">等待對方擲骰...</p>}
        {bothRolled && !inDate && <p className="text-gray-400 text-sm text-center">結算中...</p>}
      </div>
    )
  }

  // ── PARTY ROLLING ──
  if (state.phase === 'party_rolling') {
    const host = players.find(p => p.id === pd.host_id)
    const partyRolls = (pd.party_rolls ?? {}) as Record<string, number>
    const activePlayers = players.filter(p => !p.is_bankrupt)
    const myRollDone = partyRolls[myId] !== undefined
    const allDone = Object.keys(partyRolls).length === activePlayers.length

    return (
      <div className="bg-white rounded-2xl p-4 shadow">
        <p className="font-bold text-yellow-600 text-center mb-1">🎉 多人派對！</p>
        <p className="text-xs text-center text-gray-400 mb-3">
          {host?.name} 舉辦派對，擲出偶數者得孩子！
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {activePlayers.map(p => {
            const roll = partyRolls[p.id]
            const isWinner = roll !== undefined && roll % 2 === 0 && allDone
            return (
              <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${isWinner ? 'border-yellow-400 bg-yellow-50' : 'border-gray-100 bg-gray-50'}`}>
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-sm font-medium flex-1">{p.name}</span>
                {roll !== undefined
                  ? <span className="text-lg">{DICE_FACES[roll]}<span className="text-sm font-bold ml-1">{roll}</span></span>
                  : <span className="text-gray-300 text-sm">🎲 等待中...</span>
                }
                {isWinner && <span className="text-xs text-yellow-600 font-bold">🏆</span>}
              </div>
            )
          })}
        </div>
        {!myRollDone
          ? btn('🎲 擲骰子！', 'party_roll', undefined, 'w-full bg-yellow-500 hover:bg-yellow-600')
          : Object.keys(partyRolls).length < activePlayers.length && (
            <p className="text-gray-400 text-sm text-center">等待其他玩家擲骰...</p>
          )
        }
      </div>
    )
  }

  // ── END TURN ──
  if (state.phase === 'end_turn') {
    if (!isMyTurn) {
      return (
        <div className="bg-white rounded-2xl p-4 shadow">
          <TurnRecap logs={turnLogs} />
          <div className="text-center text-gray-400 text-sm">
            等待 <span className="font-bold" style={{ color: currentPlayer?.color }}>{currentPlayer?.name}</span> 結束回合...
          </div>
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
        <TurnRecap logs={turnLogs} />
        {btn('✅ 結束回合', 'end_turn', undefined, 'w-full bg-green-500 hover:bg-green-600')}
      </div>
    )
  }

  return null
}
