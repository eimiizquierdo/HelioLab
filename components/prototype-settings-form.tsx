"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updatePrototypeInfo, updatePrototypeViewers } from "@/lib/client-api"
import { UserViewerSelector } from "@/components/user-viewer-selector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Copy, Check, Loader2, ArrowLeft } from "lucide-react"

const TIMEZONES = [
  { value: -8, label: "México Noroeste (UTC-8)" },
  { value: -7, label: "México Pacífico (UTC-7)" },
  { value: -6, label: "México Centro (UTC-6)" },
  { value: -5, label: "México Sureste (UTC-5)" },
]

interface PrototypeSettingsFormProps {
  prototypeId: string
  currentUserId: string
  initial: {
    name: string
    label: string
    type: "fotovoltaico" | "eolico"
    code: string
    lat: number | null
    lon: number | null
    timezone: number | null
    beta: number | null
    viewerIds: string[]
  }
}

export function PrototypeSettingsForm({ prototypeId, currentUserId, initial }: PrototypeSettingsFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const [name, setName] = useState(initial.name)
  const [label, setLabel] = useState(initial.label)
  const [lat, setLat] = useState(initial.lat != null ? String(initial.lat) : "")
  const [lon, setLon] = useState(initial.lon != null ? String(initial.lon) : "")
  const [timezone, setTimezone] = useState(initial.timezone ?? -6)
  const [beta, setBeta] = useState(initial.beta != null ? String(initial.beta) : "")
  const [viewerIds, setViewerIds] = useState<string[]>(initial.viewerIds)

  const saveUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/prototype/${prototypeId}/save_data`
    : ""

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !label || !lat || !lon) {
      toast.error("Por favor completa todos los campos requeridos")
      return
    }
    setSaving(true)
    try {
      await Promise.all([
        updatePrototypeInfo({
          prototypeId,
          name,
          label,
          lat: parseFloat(lat),
          lon: parseFloat(lon),
          timezone,
          beta: initial.type === "fotovoltaico" && beta ? parseFloat(beta) : undefined,
        }),
        updatePrototypeViewers({ prototypeId, viewerIds }),
      ])
      toast.success("Cambios guardados")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(saveUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(initial.code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-xl">
      <div className="flex flex-col gap-1">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al dashboard
        </button>
        <h1 className="text-xl font-bold text-foreground mt-2">Configuración del prototipo</h1>
        <p className="text-sm text-muted-foreground">
          Solo tú, como dueño, puedes ver y editar esta información.
        </p>
      </div>

      {/* Credenciales del dispositivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Credenciales del dispositivo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">URL de guardado de datos</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs break-all rounded bg-muted px-3 py-2 border text-foreground">
                {saveUrl}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyUrl} className="shrink-0">
                {copiedUrl ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Código de autorización</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs break-all rounded bg-muted px-3 py-2 border text-foreground">
                {initial.code}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyCode} className="shrink-0">
                {copiedCode ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Datos editables */}
      <form onSubmit={handleSave} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre interno</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label">Etiqueta visible</Label>
            <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lat">Latitud</Label>
            <Input id="lat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lon">Longitud</Label>
            <Input id="lon" type="number" step="any" value={lon} onChange={(e) => setLon(e.target.value)} required />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Zona horaria</Label>
          <Select value={String(timezone)} onValueChange={(v) => setTimezone(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={String(tz.value)}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {initial.type === "fotovoltaico" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="beta">Inclinación del panel β (grados)</Label>
            <Input id="beta" type="number" step="any" value={beta} onChange={(e) => setBeta(e.target.value)} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>Usuarios con acceso</Label>
          <p className="text-xs text-muted-foreground">
            Busca por nombre. Los usuarios seleccionados podrán ver los datos de este prototipo.
          </p>
          <UserViewerSelector
            selectedIds={viewerIds}
            onChange={setViewerIds}
            excludeIds={[currentUserId]}
          />
        </div>

        <Button type="submit" disabled={saving} className="mt-2">
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar cambios"}
        </Button>
      </form>
    </div>
  )
}