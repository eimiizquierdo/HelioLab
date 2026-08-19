"use client"

import { useState, useEffect, useCallback } from "react"
import { adminGetUsers, adminCreateUser, adminDeleteUser } from "@/lib/client-api"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Trash2, UserPlus, Loader2 } from "lucide-react"

type UserRow = {
  id: string
  name: string
  last_name: string
  email: string
  degree: string
  role: string
  timezone: string
  profile_picture: string
}

const TIMEZONES = [
  { value: "UTC-08:00", label: "México Noroeste (UTC-8)" },
  { value: "UTC-07:00", label: "México Pacífico (UTC-7)" },
  { value: "UTC-06:00", label: "México Centro (UTC-6)" },
  { value: "UTC-05:00", label: "México Sureste (UTC-5)" },
]

export function AdminPanel() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Formulario nuevo usuario
  const [name, setName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [degree, setDegree] = useState("")
  const [timezone, setTimezone] = useState("UTC-06:00")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("user")

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await adminGetUsers()
      setUsers(data)
    } catch {
      toast.error("Error al cargar usuarios")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      await adminCreateUser({ name, last_name: lastName, email, degree, timezone, password, role })
      toast.success("Usuario creado correctamente")
      setDialogOpen(false)
      // Reset form
      setName(""); setLastName(""); setEmail("")
      setDegree(""); setPassword(""); setRole("user")
      setTimezone("UTC-06:00")
      await loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear usuario")
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(userId: string, userName: string) {
    if (!confirm(`¿Eliminar a ${userName}? Esta acción no se puede deshacer.`)) return
    setDeleting(userId)
    try {
      await adminDeleteUser(userId)
      toast.success("Usuario eliminado")
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar usuario")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Gestión de usuarios</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Nuevo usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Crear usuario</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-name">Nombre(s)</Label>
                  <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-last">Apellidos</Label>
                  <Input id="new-last" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-email">Email</Label>
                <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-degree">Grado académico</Label>
                <Input id="new-degree" value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="Ej: Estudiante" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-tz">Zona horaria</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-role">Rol</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuario</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-pass">Contraseña provisional</Label>
                <Input
                  id="new-pass"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Esta contraseña se comparte con el usuario externamente
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</> : "Crear usuario"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            {loading ? "Cargando..." : `${users.length} usuario${users.length !== 1 ? "s" : ""}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Grado</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name} {u.last_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                    <TableCell className="text-sm">{u.degree}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        u.role === "admin"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {u.role === "admin" ? "Admin" : "Usuario"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(u.id, `${u.name} ${u.last_name}`)}
                        disabled={deleting === u.id}
                      >
                        {deleting === u.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />
                        }
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
