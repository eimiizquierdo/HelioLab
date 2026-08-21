import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

// POST /api/prototype/[prototype]/get_settings
// Solo el dueño puede ver la configuración completa (incluye el código de autorización)
export async function POST(
  req: NextRequest,
  { params }: { params: { prototype: string } }
) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("session_user_id")?.value;
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { prototype: prototypeId } = await params;
  const protoDoc = await db.collection("Prototype").doc(prototypeId).get();
  if (!protoDoc.exists) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const d = protoDoc.data()!;
  const ownerRef = d.owner as admin.firestore.DocumentReference;
  if (ownerRef?.id !== userId) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const viewers = (d.viewers ?? []) as admin.firestore.DocumentReference[];
  const viewerIds = viewers.map((v) => v.id);

  return NextResponse.json({
    id: protoDoc.id,
    name: d.name ?? "",
    label: d.label ?? "",
    type: (d.type ?? "fotovoltaico") as "fotovoltaico" | "eolico",
    code: d.code ?? "",
    lat: typeof d.lat === "number" ? d.lat : null,
    lon: typeof d.lon === "number" ? d.lon : null,
    timezone: typeof d.timezone === "number" ? d.timezone : null,
    beta: typeof d.beta === "number" ? d.beta : null,
    viewerIds,
  }, { status: 200 });
}