import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
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

  const protoData = protoDoc.data()!;
  const userDoc = await db.collection("User").doc(userId).get();
  const isAdmin = userDoc.data()?.role === "admin";
  const isOwner = (protoData.owner as admin.firestore.DocumentReference)?.id === userId;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const newViewerIds: string[] = viewerIds ?? [];
  const previousViewerIds = ((protoData.viewers ?? []) as admin.firestore.DocumentReference[]).map(
    (v) => v.id,
  );
  const addedViewerIds = newViewerIds.filter((id) => !previousViewerIds.includes(id));

  const viewerRefs = newViewerIds.map((id: string) => db.collection("User").doc(id));
  await db.collection("Prototype").doc(protoId).update({ viewers: viewerRefs });

  // Notificar a los usuarios recién agregados como viewers
  if (addedViewerIds.length > 0) {
    const grantorName = `${userDoc.data()?.name ?? ""} ${userDoc.data()?.last_name ?? ""}`.trim();
    const label = protoData.label ?? protoData.name ?? "un prototipo";
    const now = admin.firestore.Timestamp.now();

    for (const viewerId of addedViewerIds) {
      if (viewerId === userId) continue;
      await db.collection("Notification").add({
        type: "added_viewer",
        has_been_read: false,
        text: `${grantorName} te dio acceso al prototipo "${label}"`,
        prototype: db.collection("Prototype").doc(protoId),
        user: db.collection("User").doc(viewerId),
        creation_date: now,
      });
    }
  }

  return NextResponse.json({ ok: true });
}