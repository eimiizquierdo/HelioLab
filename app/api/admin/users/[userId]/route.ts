import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

async function requireAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("session_user_id")?.value;
  if (!userId) return null;
  const doc = await db.collection("User").doc(userId).get();
  if (!doc.exists || doc.data()?.role !== "admin") return null;
  return userId;
}

// DELETE /api/admin/users/[userId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { userId } = await params;

  if (userId === adminId) {
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
  }

  await db.collection("User").doc(userId).delete();
  return NextResponse.json({ ok: true }, { status: 200 });
}