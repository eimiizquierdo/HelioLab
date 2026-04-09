"use client"

import { useMemo } from "react"
import type { ChatAsPost } from "@/lib/types/frontend-types"
import { ChatAsPostCard } from "@/components/chat-as-post-card"

interface ChatsFeedProps {
  chats: ChatAsPost[]
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

export function ChatsFeed({ chats }: ChatsFeedProps) {
  const grouped = useMemo(() => {

    const groups = new Map<string, ChatAsPost[]>()

    for (const chat of chats) {
      const dayKey = new Date(chat.creation_date).toISOString().split("T")[0]
      if (!groups.has(dayKey)) groups.set(dayKey, [])
      groups.get(dayKey)!.push(chat)
    }

    return Array.from(groups.entries()).map(([dayKey, dayChats]) => {
      const date = new Date(dayKey + "T12:00:00")
      const dayName = DAY_NAMES[date.getDay()] ?? dayKey
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
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}