'use client'
import { useEffect, useRef } from 'react'
import { GameLog } from '@/lib/types'

interface Props {
  logs: GameLog[]
}

export default function EventLog({ logs }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="bg-white rounded-2xl shadow p-4 flex flex-col h-48">
      <h2 className="font-bold text-gray-700 text-sm mb-2">📜 遊戲紀錄</h2>
      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {logs.slice(-30).map(log => (
          <p key={log.id} className="text-xs text-gray-600 leading-relaxed">
            {log.message}
          </p>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
