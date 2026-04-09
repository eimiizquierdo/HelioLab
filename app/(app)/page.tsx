'use server'

import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { db } from "@/lib/firebase-admin"
import { getAllPrototypesData, getFeed } from "@/lib/api-client"
import type { UserLocal } from "@/lib/types/frontend-types"
import type { Reading, Prototype } from "@/lib/types/backend-types"
import type { ChatAsPost, ChatAsHighlight } from "@/lib/types/frontend-types"
import { Dashboard } from "@/components/dashboard"

export interface PrototypeData {
  prototype: Prototype
  readings: Reading[]
  highlights: ChatAsHighlight[]
}

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("session_user_id")?.value
  if (!userId) redirect("/login")

  const userDoc = await db.collection("User").doc(userId).get()
  if (!userDoc.exists) redirect("/login")

  const { hashed_password, ...userLocal } = userDoc.data()!
  const currentUser = { id: userDoc.id, ...userLocal } as UserLocal

  const [prototypeData, initialFeed] = await Promise.all([
    getAllPrototypesData(),
    getFeed({ researcherId: currentUser.id }),
  ])

  // Transform the data to match the expected format
  const transformedPrototypeData: PrototypeData[] = prototypeData.map(({ prototype, readings, highlights }) => ({
    prototype,
    readings: readings.map((r) => ({
      ...r,
      date: new Date(r.date),
    })),
    highlights,
  }))

  return (
    <Dashboard
      currentUser={currentUser}
      initialPrototypeData={transformedPrototypeData}
      initialFeed={initialFeed}
    />
  )
}