import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { db } from "@/lib/firebase-admin"
import { AdminPanel } from "@/components/admin-panel"

export default async function AdminPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get("session_user_id")?.value
  if (!userId) redirect("/login")

  const userDoc = await db.collection("User").doc(userId).get()
  if (!userDoc.exists || userDoc.data()?.role !== "admin") redirect("/")

  return <AdminPanel />
}
