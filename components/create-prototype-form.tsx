"use client"

import { useState } from "react"
import { createPrototype } from "@/lib/client-api"
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
import { Copy, Check, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

const TIMEZONES = [
  { value: -8, label: "México Noroeste (UTC-8)" },
  { value: -7, label: "México Pacífico (UTC-7)" },
  { value: -6, label: "México Centro (UTC-6)" },
  { value: -5, label: "México Sureste (UTC-5)" },
]

interface CreatePrototypeFormProps {
  currentUserId: string
}

export function CreatePrototypeForm({ currentUserId }: CreatePrototypeFormProps) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Campos del formulario
  const [name, setName] = useState("")
  const [label, setLabel] = useState("")
  const [code, setCode] = useState("")
  const [type, setType] = useState<"fotovoltaico" | "eolico">("fotovoltaico")
  const [lat, setLat] = useState("")
  const [lon, setLon] = useState("")
  const [timezone, setTimezone] = useState(-6)
  const [beta, setBeta] = useState("")
  const [viewerIds, setViewerIds] = useState<string[]>([])

  const saveUrl = createdId
    ? `${window.location.origin}/api/prototype/${createdId}/save_data`
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !label || !code || !lat || !lon) {
      toast.error("Por favor completa todos los campos requeridos")
      return
    }
    setCreating(true)
    try {
      const result = await createPrototype({
        name,
        label,
        code,
        type,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        timezone,
        beta: type === "fotovoltaico" && beta ? parseFloat(beta) : undefined,
        viewerIds,
      })
      setCreatedId(result.id)
      toast.success("Prototipo creado correctamente")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear prototipo")
    } finally {
      setCreating(false)
    }
  }

  function handleCopy() {
    if (!saveUrl) return
    navigator.clipboard.writeText(saveUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Pantalla de éxito con la URL
  if (createdId && saveUrl) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-xl">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-foreground">¡Prototipo creado!</h1>
          <p className="text-sm text-muted-foreground">
            Copia la URL de guardado para configurar tu dispositivo.
          </p>
        </div>

        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="text-sm text-green-700 dark:text-green-400">
              URL de guardado de datos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <code className="text-xs break-all rounded bg-background px-3 py-2 border text-foreground">
              {saveUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="self-start gap-2"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar URL"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Usa esta URL en tu ESP32 o dispositivo para enviar lecturas al sistema. 
              Guárdala en un lugar seguro.
            </p>
          </CardContent>
        </Card>

        <Button onClick={() => router.push("/")}>
          Ir al dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">Nuevo prototipo</h1>
        <p className="text-sm text-muted-foreground">
          Configura los datos de tu prototipo de monitoreo.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Tipo */}
        <div className="flex flex-col gap-1.5">
          <Label>Tipo de prototipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as "fotovoltaico" | "eolico")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fotovoltaico">Fotovoltaico (CPV)</SelectItem>
              <SelectItem value="eolico">Eólico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Nombre y label */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre interno</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Prototipo SJR" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label">Etiqueta visible</Label>
            <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: Prototipo México 1" required />
          </div>
        </div>

        {/* Código */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">Código</Label>
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej: CPV-001" required />
        </div>

        {/* Coordenadas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lat">Latitud</Label>
            <Input id="lat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Ej: 20.36725" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lon">Longitud</Label>
            <Input id="lon" type="number" step="any" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="Ej: -100.0102" required />
          </div>
        </div>

        {/* Zona horaria */}
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

        {/* Beta solo para fotovoltaico */}
        {type === "fotovoltaico" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="beta">Inclinación del panel β (grados)</Label>
            <Input id="beta" type="number" step="any" value={beta} onChange={(e) => setBeta(e.target.value)} placeholder="Ej: 21" />
          </div>
        )}

        {/* Selector de viewers */}
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

        <Button type="submit" disabled={creating} className="mt-2">
          {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</> : "Crear prototipo"}
        </Button>
      </form>
    </div>
  )
}
