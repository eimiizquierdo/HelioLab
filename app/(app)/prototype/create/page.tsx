import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { db } from "@/lib/firebase-admin"
import { CreatePrototypeForm } from "@/components/create-prototype-form"

export default async function CreatePrototypePage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("session_user_id")?.value
  if (!userId) redirect("/login")

  const userDoc = await db.collection("User").doc(userId).get()
  if (!userDoc.exists) redirect("/login")

  return <CreatePrototypeForm currentUserId={userId} />
}
