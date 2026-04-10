'use server'

import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { db } from "@/lib/firebase-admin"
import { getFeed, getPrototypes } from "@/lib/client-api"
import type { ChatAsPost, FrontendPrototype, FrontendUser } from "@/lib/types/frontend-data-model"
import type { PrototypeData } from "@/lib/types/frontend-data-model"
import { Dashboard } from "@/components/dashboard"

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("session_user_id")?.value
  if (!userId) redirect("/login")

  const userDoc = await db.collection("User").doc(userId).get()
  if (!userDoc.exists) redirect("/login")

  const { hashed_password, ...userLocal } = userDoc.data()!
  const currentUser = { id: userDoc.id, ...userLocal } as FrontendUser

  const [initialPrototypes, initialFeed]: [FrontendPrototype[], ChatAsPost[]] = await Promise.all([
    getPrototypes({}),
    getFeed({ researcherId: currentUser.id }),
  ])

  return (
    <Dashboard
      currentUser={currentUser}
      initialPrototypes={initialPrototypes}
      initialFeed={initialFeed}
    />
  )
}