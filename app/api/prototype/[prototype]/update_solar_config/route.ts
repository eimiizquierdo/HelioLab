import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

// PATCH /api/prototype/[prototype]/update_solar_config
// Solo el dueño del prototipo puede guardar los valores
export async function PATCH(
  req: NextRequest,
  { params }: { params: { prototype: string } }
) {
  try {
    const prototypeId = params.prototype;
    const body = await req.json();
    const { userId, lat, lon, timezone, beta } = body;

    // Validar que los campos existan y sean numeros
    if (
      typeof lat      !== "number" ||
      typeof lon      !== "number" ||
      typeof timezone !== "number" ||
      typeof beta     !== "number" ||
      typeof userId   !== "string"
    ) {
      return NextResponse.json({ error: "Campos invalidos" }, { status: 400 });
    }

    // Verificar que el usuario sea el dueno del prototipo
    const protoDoc = await db.collection("Prototype").doc(prototypeId).get();
    if (!protoDoc.exists) {
      return NextResponse.json({ error: "Prototipo no encontrado" }, { status: 404 });
    }

    const ownerRef = protoDoc.data()?.owner;
    if (!ownerRef || ownerRef.id !== userId) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    // Guardar los nuevos valores
    await db.collection("Prototype").doc(prototypeId).update({ lat, lon, timezone, beta });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("update_solar_config error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}