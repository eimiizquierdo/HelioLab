"use client"

import { useState, useEffect } from "react"
import { updateUserProfile } from "@/lib/client-api"
import { useAuth } from "@/lib/auth-context"
import type { UserLocal } from "@/lib/types/frontend-types"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

const TIMEZONES: { value: string; label: string }[] = [
  { value: "UTC-8", label: "México Noroeste" },
  { value: "UTC-7", label: "México Pacífico" },
  { value: "UTC-6", label: "México Centro" },
  { value: "UTC-5", label: "México Sureste" },
  { value: "UTC+1", label: "España" },
]

interface ProfileFormProps {
  currentUser: UserLocal
}

export function ProfileForm({ currentUser }: ProfileFormProps) {
  const { refreshUser } = useAuth()
  const [name, setName] = useState(currentUser.name)
  const [lastName, setLastName] = useState(currentUser.last_name)
  const [degree, setDegree] = useState(currentUser.degree)
  const [timezone, setTimezone] = useState(currentUser.timezone)
  const [saving, setSaving] = useState(false)

  const fullName = `${currentUser.name} ${currentUser.last_name}`
  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await updateUserProfile({
      userId: currentUser.id,
      name: name.trim(),
      last_name: lastName.trim(),
      degree: degree.trim(),
      timezone,
    })
    await refreshUser()
    setSaving(false)
    toast.success("Perfil actualizado correctamente")
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Mi perfil</h1>

      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={currentUser.profile_picture} alt={fullName} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{fullName}</CardTitle>
              <p className="text-sm text-muted-foreground">{currentUser.email}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nombre(s)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="last-name">Apellidos</Label>
              <Input
                id="last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="degree">Grado academico</Label>
              <Input
                id="degree"
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                placeholder="Ej: Doctor en Mecatronica Aplicada"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="timezone">Zona horaria</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona tu zona horaria" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={saving} className="mt-2 self-start">
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
