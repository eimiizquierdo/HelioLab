"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { getFollowedChats, getNotifications } from "@/lib/client-api"
import type { FollowedChat, Notification } from "@/lib/types/backend-types"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Bell, LogOut, Menu, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

export function AppSidebar() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [followedChats, setFollowedChats] = useState<FollowedChat[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (user) {
      getFollowedChats({ userId: user.id }).then(setFollowedChats)
      getNotifications({ userId: user.id }).then(setNotifications)
    }
  }, [user])

  if (!user) return null

  const unreadCount = notifications.filter((n) => !n.has_been_read).length
  const initials = (user.name + " " + user.last_name)
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)

  async function handleLogout() {
    await logout()
    router.replace("/login")
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-background">
      {/* Header with logo */}
      <Link href={"/"} className="flex items-center justify-center gap-2 border-b border-border px-4 py-3">
        <Sun className="size-5 text-chart-1" strokeWidth={2.5} />
        <span className="text-base font-bold tracking-tight text-foreground">
          HelioLab
        </span>
      </Link>

      {/* User info */}
      <Link
        href="/profile"
        className={cn(
          "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent",
          pathname === "/profile" && "bg-accent"
        )}
      >
        <Avatar className="size-10">
          <AvatarImage src={user.profile_picture} alt={user.name + " " + user.last_name} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col overflow-hidden">
          <span className="truncate text-sm font-semibold text-foreground">
            {user.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {user.degree}
          </span>
        </div>
      </Link>

      <Separator />

      {/* Nav links */}
      <nav className="flex flex-col gap-0.5 px-2 py-2">
        <Link
          href="/notifications"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
            pathname === "/notifications" && "bg-accent"
          )}
        >
          <Bell className="size-4 text-muted-foreground" />
          <span className="text-foreground">Notificaciones</span>
          {unreadCount > 0 && (
            <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-chart-1 text-[10px] font-bold text-foreground">
              {unreadCount}
            </span>
          )}
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
        >
          <LogOut className="size-4 text-muted-foreground" />
          <span className="text-foreground">Cerrar sesion</span>
        </button>
      </nav>

      <Separator />

      {/* Followed chats */}
      <div className="px-4 pt-3 pb-1">
        <span className="text-xs font-semibold text-foreground">
          Chats Seguidos ({followedChats.length})
        </span>
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="flex flex-col gap-0.5 py-1">
          {followedChats.map((fc) => (
            <Link
              key={fc.id}
              href={`/chat/${fc.chat}`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                pathname === `/chat/${fc.chat}` && "bg-accent"
              )}
            >
              <span className="flex-1 truncate text-foreground">
                {fc.name}
              </span>
              <Menu className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
          {followedChats.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No sigues ningun chat aun.
            </p>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
