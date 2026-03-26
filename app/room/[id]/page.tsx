'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Player } from '@/lib/types'

const COLORS: Record<string, string> = {
  '#ef4444': 'bg-red-400',
  '#3b82f6': 'bg-blue-400',
  '#22c55e': 'bg-green-400',
  '#f59e0b': 'bg-amber-400',
  '#a855f7': 'bg-purple-400',
  '#ec4899': 'bg-pink-400',
  '#14b8a6': 'bg-teal-400',
  '#f97316': 'bg-orange-400',
}

export default function RoomPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [myId, setMyId] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  useEffect(() => {
    const pid = localStorage.getItem('playerId') ?? ''
    setMyId(pid)

    async function load() {
      const { data } = await supabase.from('players').select().eq('room_id', id)
      if (data) setPlayers(data as Player[])

      // Check if game already started
      const { data: room } = await supabase.from('rooms').select().eq('id', id).single()
      if (room?.status === 'playing') router.push(`/game/${id}`)
    }
    load()

    const channel = supabase
      .channel(`room-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => load())
      .subscribe()

    const poll = setInterval(load, 2000)

    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [id, router])

  const isHost = players.length > 0 && players.sort((a, b) => a.turn_order - b.turn_order)[0]?.id === myId

  async function startGame() {
    if (players.length < 2) return alert('至少需要 2 名玩家才能開始！')
    setLoading(true)
    const res = await fetch('/api/room/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: id, playerId: myId }),
    })
    if (!res.ok) {
      const d = await res.json()
      alert(d.error)
      setLoading(false)
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-amber-700 text-center mb-1">🤰 大腹翁</h1>
        <p className="text-center text-gray-500 text-sm mb-6">等待玩家加入中...</p>

        <div className="bg-amber-50 rounded-xl p-4 text-center mb-6">
          <p className="text-xs text-gray-500 mb-1">房間號碼</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold tracking-widest text-amber-700">{id}</span>
            <button onClick={copyCode} className="text-lg text-amber-500 hover:text-amber-700 min-w-[44px] min-h-[44px] flex items-center justify-center">
              {copied ? '✅' : '📋'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">分享給朋友，讓他們輸入這個號碼加入</p>
          <button
            onClick={copyLink}
            className="mt-2 text-xs text-amber-600 hover:text-amber-800 underline transition min-h-[44px] px-2"
          >
            {copiedLink ? '✅ 連結已複製！' : '🔗 複製房間連結'}
          </button>
        </div>

        <div className="mb-6">
          <h2 className="font-bold text-gray-700 mb-3">玩家 ({players.length}/8)</h2>
          <div className="flex flex-col gap-2">
            {players.sort((a, b) => a.turn_order - b.turn_order).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: p.color }}
                >
                  {p.name[0]}
                </div>
                <span className="font-medium">{p.name}</span>
                {i === 0 && <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">房主</span>}
                {p.id === myId && <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">你</span>}
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button
            onClick={startGame}
            disabled={loading || players.length < 2}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-lg transition"
          >
            {loading ? '開始中...' : '🎮 開始遊戲'}
          </button>
        ) : (
          <p className="text-center text-gray-400 text-sm">等待房主開始遊戲...</p>
        )}
      </div>
    </div>
  )
}
