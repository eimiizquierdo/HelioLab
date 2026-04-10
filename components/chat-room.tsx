"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import {
  addChatMessage,
  getFollowedChats,
  followChat,
  unfollowChat,
  apiEndpoint,
} from "@/lib/client-api"
import type { UserLocal } from "@/lib/types/frontend-types"
import type { ChatAsMessage } from "@/lib/types/frontend-types"
import type { FollowedChat } from "@/lib/types/backend-types"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, BookmarkPlus, BookmarkMinus, Send } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface ChatRoomProps {
  chatId: string
  currentUser: UserLocal
}

function toDate(ts: unknown): Date {
  if (ts instanceof Date) return ts
  const t = ts as any
  const seconds = t._seconds ?? t.seconds
  return new Date(seconds * 1000)
}

function formatTime(ts: unknown) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(toDate(ts))
}

function formatDate(ts: unknown) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(toDate(ts))
}

function toDateString(ts: unknown) {
  return toDate(ts).toDateString()
}

async function fetchMessages(
  chatId: string,
  researcherId: string,
  limitDate?: string,
): Promise<ChatAsMessage[]> {
  const res = await fetch(apiEndpoint(`/api/chat/${chatId}/get_messages`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      researcher: researcherId,
      limit_date: limitDate ?? null,
    }),
  })
  if (!res.ok) throw new Error(`get_messages failed: ${res.status}`)
  const data = await res.json()
  return data.messages as ChatAsMessage[]
}

export function ChatRoom({ chatId, currentUser }: ChatRoomProps) {
  const [messages, setMessages] = useState<ChatAsMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isFollowed, setIsFollowed] = useState(false)
  const [followedChats, setFollowedChats] = useState<FollowedChat[]>([])
  const [isPending, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Initial load
  useEffect(() => {
    fetchMessages(chatId, currentUser.id).then((msgs) =>
      setMessages([...msgs].reverse())
    )

    getFollowedChats({ userId: currentUser.id }).then((fcs) => {
      setFollowedChats(fcs)
      setIsFollowed(fcs.some((fc) => fc.chat === chatId))
    })
  }, [chatId, currentUser.id])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = newMessage.trim()
    if (!text) return

    setNewMessage("")

    // Optimistic message while the request is in-flight
    const optimistic: ChatAsMessage = {
      text,
      author: {
        full_name: `${currentUser.name} ${currentUser.last_name}`,
        degree: currentUser.degree,
        timezone: currentUser.timezone,
        profile_picture: currentUser.profile_picture,
      },
      creation_time: new Date() as any,
      is_myself: true,
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      await addChatMessage({
        userId: currentUser.id,
        chatId,
        comment: text,
      })
    } catch {
      // Roll back the optimistic message on failure
      setMessages((prev) => prev.filter((m) => m !== optimistic))
      setNewMessage(text)
    }
  }

  function handleToggleFollow() {
    startTransition(async () => {
      if (isFollowed) {
        await unfollowChat(currentUser.id, chatId)
        setIsFollowed(false)
      } else {
        const chatName =
          messages[0]?.text.slice(0, 40) || `Chat ${chatId.slice(0, 6)}`
        await followChat({ userId: currentUser.id, chatId, name: chatName })
        setIsFollowed(true)
      }
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-border px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver
        </Link>

        <div className="flex flex-1" />

        <Button
          variant={isFollowed ? "outline" : "default"}
          size="sm"
          onClick={handleToggleFollow}
          disabled={isPending}
          className="gap-1.5"
        >
          {isFollowed ? (
            <>
              <BookmarkMinus className="size-4" />
              Dejar de seguir
            </>
          ) : (
            <>
              <BookmarkPlus className="size-4" />
              Seguir chat
            </>
          )}
        </Button>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="flex flex-col gap-4 p-6">
          {messages.map((msg, i) => {
            const prevMsg = messages[i - 1]
            const showDate =
              !prevMsg ||
              toDateString(msg.creation_time) !==
                toDateString(prevMsg.creation_time)

            const initials = msg.author.full_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)

            return (
              <div key={i}>
                {showDate && (
                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs capitalize text-muted-foreground">
                      {formatDate(msg.creation_time)}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div
                  className={cn(
                    "flex items-start gap-3",
                    msg.is_myself && "flex-row-reverse",
                  )}
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage
                      src={msg.author.profile_picture}
                      alt={msg.author.full_name}
                    />
                    <AvatarFallback className="text-[10px]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "flex max-w-md flex-col gap-1 rounded-lg px-4 py-2",
                      msg.is_myself
                        ? "bg-foreground text-background"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {!msg.is_myself && (
                      <span className="text-xs font-semibold">
                        {msg.author.full_name}
                      </span>
                    )}
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    <span
                      className={cn(
                        "text-[10px]",
                        msg.is_myself
                          ? "text-background/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatTime(msg.creation_time)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Message input */}
      <div className="border-t border-border px-6 py-3">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <Input
            placeholder="Escribe un mensaje..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isPending || !newMessage.trim()}
          >
            <Send className="size-4" />
            <span className="sr-only">Enviar mensaje</span>
          </Button>
        </form>
      </div>
    </div>
  )
}