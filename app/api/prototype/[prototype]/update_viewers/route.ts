import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

// PATCH /api/prototype/[prototype]/update_viewers
export async function PATCH(
  req: NextRequest,
  { params }: { params: { prototype: string } }
) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("session_user_id")?.value;
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { prototype: protoId } = await params;
  const { viewerIds } = await req.json();

  const protoDoc = await db.collection("Prototype").doc(protoId).get();
  if (!protoDoc.exists) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const userDoc = await db.collection("User").doc(userId).get();
  const isAdmin = userDoc.data()?.role === "admin";
  const isOwner = (protoDoc.data()?.owner as FirebaseFirestore.DocumentReference)?.id === userId;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const viewerRefs = (viewerIds ?? []).map((id: string) => db.collection("User").doc(id));
  await db.collection("Prototype").doc(protoId).update({ viewers: viewerRefs });

  return NextResponse.json({ ok: true });
}