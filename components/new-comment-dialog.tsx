"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { addComment } from "@/lib/client-api"
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
import { MessageSquarePlus } from "lucide-react"

interface NewCommentDialogProps {
  prototypeId: string
  onCommentAdded: () => void
}

export function NewCommentDialog({
  prototypeId,
  onCommentAdded,
}: NewCommentDialogProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !text.trim()) return

    setSubmitting(true)
    const chatId = `ch${Date.now()}`
    await addComment({
      chat: chatId,
      full_name: user.full_name,
      creation_date: new Date().toISOString(),
      author: user.id,
      degree: user.degree,
      text: text.trim(),
      prototype: prototypeId,
    })

    setText("")
    setOpen(false)
    setSubmitting(false)
    onCommentAdded()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MessageSquarePlus className="size-4" />
          Nuevo comentario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo comentario</DialogTitle>
          <DialogDescription>
            Escribe un comentario sobre los datos del prototipo. Se creara
            automaticamente una sala de conversacion.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="comment-text">Comentario</Label>
            <Input
              id="comment-text"
              placeholder="Describe lo que observas en los datos..."
              value={text}
              onChange={(e) => setText(e.target.value)}
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
            <Button type="submit" disabled={submitting || !text.trim()}>
              {submitting ? "Publicando..." : "Publicar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
