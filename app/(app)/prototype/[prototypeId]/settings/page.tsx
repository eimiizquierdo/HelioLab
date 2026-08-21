import { redirect, notFound } from "next/navigation"
import { cookies } from "next/headers"
import { db } from "@/lib/firebase-admin"
import * as admin from "firebase-admin"
import { PrototypeSettingsForm } from "@/components/prototype-settings-form"

export default async function PrototypeSettingsPage({
  params,
}: {
  params: Promise<{ prototypeId: string }>
}) {
  const { prototypeId } = await params

  const cookieStore = await cookies()
  const userId = cookieStore.get("session_user_id")?.value
  if (!userId) redirect("/login")

  const protoDoc = await db.collection("Prototype").doc(prototypeId).get()
  if (!protoDoc.exists) notFound()

  const d = protoDoc.data()!
  const ownerRef = d.owner as admin.firestore.DocumentReference
  if (ownerRef?.id !== userId) {
    redirect("/")
  }

  const viewers = (d.viewers ?? []) as admin.firestore.DocumentReference[]
  const viewerIds = viewers.map((v) => v.id)
  const protoType = (d.type ?? "fotovoltaico") as "fotovoltaico" | "eolico"

  return (
    <PrototypeSettingsForm
      prototypeId={protoDoc.id}
      currentUserId={userId}
      initial={{
        name: d.name ?? "",
        label: d.label ?? "",
        type: protoType,
        code: d.code ?? "",
        lat: typeof d.lat === "number" ? d.lat : null,
        lon: typeof d.lon === "number" ? d.lon : null,
        timezone: typeof d.timezone === "number" ? d.timezone : null,
        beta: typeof d.beta === "number" ? d.beta : null,
        viewerIds,
      }}
    />
  )
}