import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { db } from "@/lib/firebase-admin"
import { getFeed } from "@/lib/client-api"
import { getAccessiblePrototypes } from "@/lib/get-accessible-prototypes"
import type { ChatAsPost, FrontendPrototype, FrontendUser } from "@/lib/types/frontend-data-model"
import { Dashboard } from "@/components/dashboard"

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("session_user_id")?.value
  if (!userId) redirect("/login")

  const userDoc = await db.collection("User").doc(userId).get()
  if (!userDoc.exists) redirect("/login")

  const { hashed_password, last_chat_seen_time, last_interaction_time, ...userLocal } = userDoc.data()!
  const currentUser = {
    id: userDoc.id,
    ...userLocal,
    last_chat_seen_time: last_chat_seen_time?.toDate?.()?.toISOString?.() ?? null,
    last_interaction_time: last_interaction_time?.toDate?.()?.toISOString?.() ?? null,
  } as FrontendUser

  // Cargar prototipos directamente desde Firestore (evita perder cookies en fetch server-to-server)
    const initialPrototypes: FrontendPrototype[] = await getAccessiblePrototypes(
    currentUser.id,
    userDoc.data()?.role === "admin",
  )
  const initialFeed: ChatAsPost[] = initialPrototypes.length > 0
    ? await getFeed({ researcherId: currentUser.id, prototypeId: initialPrototypes[0].id })
    : []

  const initialDataFetch = new Date()

  return (
    <Dashboard
      currentUser={currentUser}
      initialPrototypes={initialPrototypes}
      initialFeed={initialFeed}
      initialDataFetch={initialDataFetch}
    />
  )
}