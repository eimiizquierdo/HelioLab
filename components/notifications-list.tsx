"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/client-api"
import type { Notification } from "@/lib/types/backend-data-model"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AtSign, CheckCheck, MessageCircle, UserPlus } from "lucide-react"

const TYPE_ICONS: Record<string, React.ElementType> = {
  new_comment_followed: MessageCircle,
  new_comment_own_prototype: MessageCircle,
  added_viewer: UserPlus,
  mention: AtSign,
}

const TYPE_LABELS: Record<string, string> = {
  new_comment_followed: "Nuevo comentario",
  new_comment_own_prototype: "Comentario en tu prototipo",
  added_viewer: "Nuevo acceso",
  mention: "Mención",
}

function relativeTime(isoString: string): string {
  const now = new Date()
  const date = new Date(isoString)
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "ahora"
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return "ayer"
  return `hace ${days} dias`
}

export function NotificationsList() {
  const { user } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (user) {
      getNotifications({ userId: user.id }).then((notifs) => {
        setNotifications(
          notifs.sort(
            (a, b) =>
              new Date(b.creation_date).getTime() -
              new Date(a.creation_date).getTime()
          )
        )
      })
    }
  }, [user])

  async function handleClick(notif: Notification) {
    if (!user) return
    if (!notif.has_been_read) {
      await markNotificationRead({ userId: user.id, notificationId: notif.id })
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, has_been_read: true } : n))
      )
    }
    if (notif.chat) {
      router.push(`/chat/${notif.chat}`)
    }
  }

  async function handleMarkAllRead() {
    if (!user) return
    await markAllNotificationsRead(user.id)
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, has_been_read: true }))
    )
  }

  const unreadCount = notifications.filter((n) => !n.has_been_read).length

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Notificaciones</h1>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="gap-1.5"
          >
            <CheckCheck className="size-4" />
            Marcar todas como leidas
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No tienes notificaciones.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {notifications.map((notif) => {
            const Icon = TYPE_ICONS[notif.type] || MessageCircle
            return (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={cn(
                  "flex items-start gap-4 rounded-lg px-4 py-3 text-left transition-colors hover:bg-accent",
                  !notif.has_been_read && "bg-accent/40"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                    !notif.has_been_read
                      ? "bg-chart-1/20 text-chart-1"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {TYPE_LABELS[notif.type] ?? "Notificación"}
                  </span>
                  <p
                    className={cn(
                      "text-sm",
                      !notif.has_been_read
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {notif.text}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeTime(notif.creation_date as unknown as string)}
                </span>
                {!notif.has_been_read && (
                  <div className="mt-1.5 size-2 shrink-0 rounded-full bg-chart-1" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}