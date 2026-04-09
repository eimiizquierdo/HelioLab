import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { db } from "@/lib/firebase-admin"
import { ProfileForm } from "@/components/profile-form"
import type { UserLocal } from "@/lib/types/frontend-types"

export default async function ProfilePage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("session_user_id")?.value

  if (!userId) redirect("/login")

  const userDoc = await db.collection("User").doc(userId).get()

  if (!userDoc.exists) redirect("/login")

  const { hashed_password, ...userLocal } = userDoc.data()!
  const currentUser = { id: userDoc.id, ...userLocal } as UserLocal

  return <ProfileForm currentUser={currentUser} />
}