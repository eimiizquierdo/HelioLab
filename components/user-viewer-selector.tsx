"use client"

import { useState, useCallback } from "react"
import { searchUsers } from "@/lib/client-api"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { X, Search, Loader2 } from "lucide-react"

type UserResult = {
  id: string
  name: string
  last_name: string
  email: string
  degree: string
  profile_picture: string
}

interface UserViewerSelectorProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  excludeIds?: string[]
}

export function UserViewerSelector({ selectedIds, onChange, excludeIds = [] }: UserViewerSelectorProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<UserResult[]>([])

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const data = await searchUsers(q)
      setResults(data.filter((u) => !excludeIds.includes(u.id) && !selectedIds.includes(u.id)))
    } finally {
      setLoading(false)
    }
  }, [excludeIds, selectedIds])

  function addUser(user: UserResult) {
    if (selectedIds.includes(user.id)) return
    const newSelected = [...selected, user]
    setSelected(newSelected)
    onChange([...selectedIds, user.id])
    setResults([])
    setQuery("")
  }

  function removeUser(userId: string) {
    const newSelected = selected.filter((u) => u.id !== userId)
    setSelected(newSelected)
    onChange(selectedIds.filter((id) => id !== userId))
  }

  const initials = (u: UserResult) =>
    `${u.name[0] ?? ""}${u.last_name[0] ?? ""}`.toUpperCase()

  return (
    <div className="flex flex-col gap-3">
      {/* Fichas de usuarios seleccionados */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={u.profile_picture} />
                <AvatarFallback className="text-[10px]">{initials(u)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col leading-tight">
                <span className="font-medium text-foreground">{u.name} {u.last_name}</span>
                <span className="text-xs text-muted-foreground">{u.degree}</span>
              </div>
              <button
                type="button"
                onClick={() => removeUser(u.id)}
                className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar por nombre..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Resultados de búsqueda */}
      {results.length > 0 && (
        <div className="flex flex-col rounded-lg border border-border bg-popover shadow-md">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => addUser(u)}
              className="flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={u.profile_picture} />
                <AvatarFallback className="text-[10px]">{initials(u)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-sm text-foreground truncate">
                  {u.name} {u.last_name}
                </span>
                <span className="text-xs text-muted-foreground truncate">{u.degree} · {u.email}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {query.length >= 2 && !loading && results.length === 0 && (
        <p className="text-xs text-muted-foreground px-1">No se encontraron usuarios.</p>
      )}
    </div>
  )
}
