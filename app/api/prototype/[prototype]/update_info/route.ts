import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

// PATCH /api/prototype/[prototype]/update_info
// Solo el dueño puede editar los datos del prototipo
export async function PATCH(
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

  const body = await req.json().catch(() => ({}));
  const { name, label, lat, lon, timezone, beta } = body;

  if (
    typeof name !== "string" || !name ||
    typeof label !== "string" || !label ||
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    typeof timezone !== "number"
  ) {
    return NextResponse.json({ error: "Campos invalidos" }, { status: 400 });
  }

  const protoType = (d.type ?? "fotovoltaico") as "fotovoltaico" | "eolico";
  const patch: Record<string, unknown> = { name, label, lat, lon, timezone };

  if (protoType === "fotovoltaico") {
    if (beta !== undefined && typeof beta !== "number") {
      return NextResponse.json({ error: "Campos invalidos" }, { status: 400 });
    }
    if (typeof beta === "number") patch.beta = beta;
  }

  await db.collection("Prototype").doc(prototypeId).update(patch);

  return NextResponse.json({ ok: true }, { status: 200 });
}