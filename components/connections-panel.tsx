"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { getConnections, addConnection, removeConnection } from "@/lib/api-client"
import type { Connection } from "@/lib/types/backend-types"
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
} from "lucide-react"

const ICON_MAP: Record<string, React.ElementType> = {
  "folder-open": FolderOpen,
  phone: Phone,
  link: LinkIcon,
  "file-text": FileText,
  video: Video,
  globe: Globe,
}

export function ConnectionsPanel() {
  const { user } = useAuth()
  const [connections, setConnections] = useState<Connection[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")

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
    <div className="flex flex-col gap-3">
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
