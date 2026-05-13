"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { getConnections, addConnection, removeConnection } from "@/lib/client-api"
import type { Connection } from "@/lib/types/backend-data-model"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  FolderOpen,
  Phone,
  Plus,
  Link as LinkIcon,
  FileText,
  Video,
  Globe,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

const ICON_MAP: Record<string, React.ElementType> = {
  "folder-open": FolderOpen,
  phone: Phone,
  link: LinkIcon,
  "file-text": FileText,
  video: Video,
  globe: Globe,
}

interface ConnectionsPanelProps {
  onDaySelect?: (date: Date) => void
}

export function ConnectionsPanel({ onDaySelect }: ConnectionsPanelProps) {
  const { user } = useAuth()
  const [connections, setConnections] = useState<Connection[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const calendarYear = calendarDate.getFullYear()
  const calendarMonth = calendarDate.getMonth()
  const monthName = calendarDate.toLocaleDateString("es-MX", { month: "long", year: "numeric" })

  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay()
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()

  function prevMonth() {
    setCalendarDate(new Date(calendarYear, calendarMonth - 1, 1))
    setSelectedDay(null)
  }

  function nextMonth() {
    setCalendarDate(new Date(calendarYear, calendarMonth + 1, 1))
    setSelectedDay(null)
  }

  useEffect(() => {
    if (user) {
      getConnections(user.id).then(setConnections)
    }
  }, [user])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !name.trim() || !url.trim()) return

    const conn = await addConnection({
      owner: user.id,
      name: name.trim(),
      link: url.trim(),
      icon: ""
    })
    setConnections((prev) => [...prev, conn])
    setName("")
    setUrl("")
    setOpen(false)
  }

  async function handleRemove(connId: string) {
    await removeConnection(connId)
    setConnections((prev) => prev.filter((c) => c.id !== connId))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <button onClick={prevMonth} className="rounded p-1 hover:bg-muted">
            <ChevronLeft className="size-4 text-muted-foreground" />
          </button>
          <span className="text-xs font-semibold capitalize text-card-foreground">
            {monthName}
          </span>
          <button onClick={nextMonth} className="rounded p-1 hover:bg-muted">
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {["D","L","M","M","J","V","S"].map((d, i) => (
            <span key={i} className="text-[10px] font-medium text-muted-foreground">{d}</span>
          ))}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <span key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const isSelected = selectedDay === day
            const isToday =
              day === new Date().getDate() &&
              calendarMonth === new Date().getMonth() &&
              calendarYear === new Date().getFullYear()
            return (
              <button
                key={day}
                onClick={() => {
                  const newSelected = isSelected ? null : day
                  setSelectedDay(newSelected)
                  if (newSelected && onDaySelect) {
                    const selected = new Date(calendarYear, calendarMonth, newSelected, 23, 59, 59)
                    onDaySelect(selected)
                  }
                }}
                className={`rounded-full text-xs py-0.5 transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-bold"
                    : isToday
                    ? "border border-primary text-primary font-semibold"
                    : "hover:bg-muted text-card-foreground"
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>
        {selectedDay && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {selectedDay} de {calendarDate.toLocaleDateString("es-MX", { month: "long" })} seleccionado
          </p>
        )}
      </div>

      <h3 className="text-base font-bold text-foreground">Conexiones</h3>

      <div className="grid grid-cols-2 gap-3">
        {connections.map((conn) => {
          const IconComp = ICON_MAP[conn.icon] || Globe
          return (
            <div
              key={conn.id}
              className="group relative flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <button
                onClick={() => handleRemove(conn.id)}
                className="absolute top-1 right-1 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                aria-label={`Eliminar ${conn.name}`}
              >
                <X className="size-3" />
              </button>
              <a
                href={conn.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2"
              >
                <IconComp className="size-10 text-muted-foreground" />
                <span className="text-center text-xs font-medium text-card-foreground">
                  {conn.name}
                </span>
              </a>
            </div>
          )
        })}

        {/* Add connection button */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card p-4 transition-colors hover:bg-accent/50">
              <Plus className="size-10 text-muted-foreground" />
              <span className="text-center text-xs font-medium text-muted-foreground">
                Anadir conexion
              </span>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Anadir conexion</DialogTitle>
              <DialogDescription>
                Agrega un enlace a tu bandeja de conexiones.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="conn-name">Nombre</Label>
                <Input
                  id="conn-name"
                  placeholder="Ej: Carpeta compartida"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="conn-url">URL</Label>
                <Input
                  id="conn-url"
                  type="url"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={!name.trim() || !url.trim()}>
                  Anadir
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
