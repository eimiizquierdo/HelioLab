"use client"

import { useMemo } from "react"
import type { ChatAsPost } from "@/lib/types/frontend-data-model"
import { ChatAsPostCard } from "@/components/chat-as-post-card"

interface ChatsFeedProps {
  chats: ChatAsPost[]
  onSeekTo?: (startDate: Date, endDate: Date) => void
}

const DAY_NAMES: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
}

export function ChatsFeed({ chats, onSeekTo }: ChatsFeedProps) {
  const grouped = useMemo(() => {

    const groups = new Map<string, ChatAsPost[]>()

    for (const chat of chats) {
      // Usar fecha local (UTC-6) para no desplazar el día por zona horaria
      const d = new Date(chat.creation_date)
      const localD = new Date(d.getTime() - 6 * 60 * 60 * 1000)
      const dayKey = localD.toISOString().split("T")[0]
      if (!groups.has(dayKey)) groups.set(dayKey, [])
      groups.get(dayKey)!.push(chat)
    }

    return Array.from(groups.entries()).map(([dayKey, dayChats]) => {
      const date = new Date(dayKey + "T12:00:00")
      // Formato completo: "Lunes, 18 de julio de 2026"
      const fullDate = date.toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
      const dayName = fullDate.charAt(0).toUpperCase() + fullDate.slice(1)
      return { dayKey, dayName, chats: dayChats }
    })
  }, [chats])

  if (grouped.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay publicaciones aún.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {grouped.map((group) => (
        <div key={group.dayKey} className="flex flex-col gap-3">
          {/* Day header */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-foreground" />
            <h3 className="text-base font-bold text-foreground">
              {group.dayName}
            </h3>
          </div>

          {/* Chats for this day */}
          <div className="flex flex-col gap-3">
            {group.chats.map((chat) => (
              <ChatAsPostCard
                key={chat.chat}
                chat={chat}
                onSeekTo={onSeekTo}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}