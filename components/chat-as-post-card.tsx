"use client"

import { useRouter } from "next/navigation"
import type { ChatAsPost } from "@/lib/types/frontend-data-model"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Star, CheckSquare, ScanSearch } from "lucide-react"

interface ChatAsPostCardProps {
  chat: ChatAsPost
  onSeekTo?: (startDate: Date, endDate: Date) => void
}

const TZ_LABELS: Record<string, string> = {
  "UTC-08:00": "Baja California",   // Zona Noroeste (PST)
  "UTC-07:00": "Zona Pacífico",     // Zona Pacífico (MST) — Sonora, Sinaloa, etc.
  "UTC-06:00": "Ciudad de México",  // Zona Centro (CST) — the most common
  "UTC-05:00": "Zona Sureste",      // Zona Sureste (EST) — Quintana Roo
  "UTC+01:00": "España",            // Spain (CET)
  "UTC+02:00": "España (verano)",   // Spain DST (CEST) — included for robustness
}

// Parses "UTC±HH:MM" into a total signed offset in minutes
function utcOffsetToMinutes(offset: string): number {
  const match = offset.match(/^UTC([+-])(\d{2}):(\d{2})$/)
  if (!match) return 0
  const sign = match[1] === "+" ? 1 : -1
  return sign * (parseInt(match[2]) * 60 + parseInt(match[3]))
}

function formatWithOffset(date: Date, offsetMinutes: number): string {
  const local = new Date(date.getTime() + offsetMinutes * 60 * 1000)
  const h = local.getUTCHours()
  const m = local.getUTCMinutes().toString().padStart(2, "0")
  const period = h >= 12 ? "p.m." : "a.m."
  const h12 = (h % 12 || 12).toString().padStart(2, "0")
  return `${h12}:${m} ${period}`
}

// Secondary reference timezone shown alongside the author's when they differ
const SECONDARY_TZ = "UTC-06:00"

function formatTimeWithTz(
  date: Date,
  timezone: string
): { primary: string; secondary?: string } {
  const authorLabel = TZ_LABELS[timezone] || timezone
  const primary = `${formatWithOffset(date, utcOffsetToMinutes(timezone))} — ${authorLabel}`

  if (timezone === SECONDARY_TZ) {
    return { primary }
  }

  const secondaryLabel = TZ_LABELS[SECONDARY_TZ]
  const secondary = `${formatWithOffset(date, utcOffsetToMinutes(SECONDARY_TZ))} — ${secondaryLabel}`
  return { primary, secondary }
}

export function ChatAsPostCard({ chat, onSeekTo }: ChatAsPostCardProps) {
  const router = useRouter()
  const { creator } = chat

  const fullName = `${creator.name} ${creator.last_name}`
  const initials = [creator.name, creator.last_name]
    .flatMap((s) => s.split(" "))
    .map((n) => n[0])
    .join("")
    .slice(0, 2)

  const countryBadge = TZ_LABELS[creator.timezone] || ""
  const offsetMinutes = utcOffsetToMinutes(creator.timezone)
  const { primary, secondary } = formatTimeWithTz(
    new Date(chat.creation_date),
    creator.timezone
  )
  const showSecondary = creator.timezone !== SECONDARY_TZ

  return (
    <button
      onClick={() => router.push(`/chat/${chat.chat}`)}
      className="w-full text-left rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Author info */}
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarImage src={creator.profile_picture} alt={fullName} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-card-foreground">
                {fullName}
              </span>
              {countryBadge && (
                <span className="text-[10px] font-medium text-muted-foreground">
                  {countryBadge}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {creator.degree}
            </span>
          </div>
        </div>

        {/* Prototype name + action icons */}
        <div className="flex items-center gap-2">
          {chat.prototype_name && (
            <span className="text-sm font-medium text-card-foreground">
              {chat.prototype_name}
            </span>
          )}
          <button
            className="text-muted-foreground transition-colors hover:text-chart-1"
            aria-label="Marcar como favorito"
            onClick={(e) => e.stopPropagation()}
          >
            <Star className="size-4" />
          </button>
          <button
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Marcar como visto"
            onClick={(e) => e.stopPropagation()}
          >
            <CheckSquare className="size-4" />
          </button>
        </div>
      </div>

      {/* Zona del gráfico referenciada */}
      {chat.highlight_start && chat.highlight_end && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-orange-400 font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>
              {formatWithOffset(new Date(chat.highlight_start), offsetMinutes)}
              {" — "}
              {formatWithOffset(new Date(chat.highlight_end), offsetMinutes)}
            </span>
          </div>
          {onSeekTo && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSeekTo(new Date(chat.highlight_start!), new Date(chat.highlight_end!))
              }}
              className="flex items-center gap-1 rounded-md border border-orange-400/30 bg-orange-400/10 px-2 py-0.5 text-[11px] text-orange-400 transition-colors hover:bg-orange-400/20"
              aria-label="Ver zona en el gráfico"
            >
              <ScanSearch className="h-3 w-3" />
              Ver en gráfico
            </button>
          )}
        </div>
      )}

      {/* First comment text */}
      {chat.first_comment_text && (
        <p className="mt-2 text-sm leading-relaxed text-card-foreground">
          {chat.first_comment_text}
        </p>
      )}

      {/* Time */}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{primary}</span>
        {showSecondary && secondary && (
          <>
            <span className="text-border">{"·"}</span>
            <span>{secondary}</span>
          </>
        )}
      </div>
    </button>
  )
}