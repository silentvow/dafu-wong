'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Player, GameState, GameLog } from '@/lib/types'
import Board from '@/components/Board'
import PlayerPanel from '@/components/PlayerPanel'
import ActionPanel from '@/components/ActionPanel'
import EventLog from '@/components/EventLog'

interface Toast {
  id: number
  message: string
}

let toastCounter = 0

export default function GamePage() {
  const { id: roomId } = useParams<{ id: string }>()
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [state, setState] = useState<GameState | null>(null)
  const [logs, setLogs] = useState<GameLog[]>([])
  const [myId, setMyId] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])
  const prevLogIdsRef = useRef<Set<number>>(new Set())
  const initialLoadRef = useRef(true)

  useEffect(() => {
    const pid = localStorage.getItem('playerId') ?? ''
    setMyId(pid)
  }, [])

  const loadAll = useCallback(async () => {
    const [{ data: ps }, { data: gs }, { data: ls }] = await Promise.all([
      supabase.from('players').select().eq('room_id', roomId),
      supabase.from('game_state').select().eq('room_id', roomId).single(),
      supabase.from('game_log').select().eq('room_id', roomId).order('id', { ascending: false }).limit(50),
    ])
    if (ps) setPlayers(ps as Player[])
    if (gs) setState(gs as GameState)
    if (ls) {
      const ordered = (ls as GameLog[]).reverse()
      setLogs(ordered)
    }
  }, [roomId])

  // Show toasts for new log entries
  useEffect(() => {
    if (logs.length === 0) return
    if (initialLoadRef.current) {
      // On first load, just record existing IDs — don't show toasts
      prevLogIdsRef.current = new Set(logs.map(l => l.id))
      initialLoadRef.current = false
      return
    }
    const newEntries = logs.filter(l => !prevLogIdsRef.current.has(l.id))
    if (newEntries.length === 0) return
    newEntries.forEach(l => prevLogIdsRef.current.add(l.id))
    const newToasts = newEntries.map(l => ({ id: ++toastCounter, message: l.message }))
    setToasts(prev => [...prev, ...newToasts].slice(-4))
    newToasts.forEach(t => {
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id))
      }, 4000)
    })
  }, [logs])

  useEffect(() => {
    loadAll()

    const channel = supabase
      .channel(`game-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, loadAll)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_log' }, loadAll)
      .subscribe()

    const poll = setInterval(loadAll, 2000)

    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [roomId, loadAll])

  async function handleAction(action: string, data?: Record<string, unknown>) {
    const res = await fetch('/api/game/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId: myId, action, data }),
    })
    if (!res.ok) {
      const d = await res.json()
      alert(d.error ?? '操作失敗')
    }
    await loadAll()
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-xl">載入中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-3 md:p-4" style={{ background: 'var(--bg-page)' }}>
      {/* Toast notifications */}
      <div className="fixed top-4 left-4 z-50 flex flex-col gap-2 items-start pointer-events-none max-w-xs">
        {toasts.map(t => (
          <div
            key={t.id}
            className="bg-gray-800 text-white text-sm px-4 py-2 rounded-xl shadow-lg animate-fade-in-up"
          >
            {t.message}
          </div>
        ))}
      </div>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-amber-800">🤰 大腹翁</h1>
          <div className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-full font-mono">#{roomId}</div>
        </div>

        {/* Mobile: ActionPanel first, then board below */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Mobile-only: action on top */}
          <div className="lg:hidden">
            <ActionPanel state={state} players={players} myId={myId} logs={logs} onAction={handleAction} />
          </div>

          {/* Board */}
          <div className="flex-shrink-0 overflow-x-auto">
            <Board players={players} state={state} myId={myId} />
          </div>

          {/* Right panels */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {/* Desktop-only: action panel */}
            <div className="hidden lg:block">
              <ActionPanel state={state} players={players} myId={myId} logs={logs} onAction={handleAction} />
            </div>
            <PlayerPanel players={players} state={state} myId={myId} />
            <EventLog logs={logs} />
          </div>
        </div>
      </div>
    </div>
  )
}
