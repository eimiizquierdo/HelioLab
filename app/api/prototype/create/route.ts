import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/firebase-admin";
import crypto from "crypto";

function generateCode(type: "fotovoltaico" | "eolico"): string {
  const prefix = type === "fotovoltaico" ? "CPV" : "EOL";
  const random = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 caracteres hex
  return `${prefix}-${random}`;
}

// POST /api/prototype/create
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("session_user_id")?.value;
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userDoc = await db.collection("User").doc(userId).get();
  if (!userDoc.exists) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, label, type, lat, lon, timezone, beta, viewerIds } = body;

  if (
    typeof name !== "string" || !name ||
    typeof label !== "string" || !label ||
    (type !== "fotovoltaico" && type !== "eolico") ||
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    typeof timezone !== "number"
  ) {
    return NextResponse.json({ error: "Campos invalidos" }, { status: 400 });
  }

  if (type === "fotovoltaico" && beta !== undefined && typeof beta !== "number") {
    return NextResponse.json({ error: "Campos invalidos" }, { status: 400 });
  }

  const viewerRefs = (Array.isArray(viewerIds) ? viewerIds : [] as string[]).map(
    (id: string) => db.collection("User").doc(id),
  );

  // Generar un código único para autenticar el guardado de lecturas
  let code = generateCode(type);
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.collection("Prototype").where("code", "==", code).limit(1).get();
    if (existing.empty) break;
    code = generateCode(type);
  }

  const newPrototype: Record<string, unknown> = {
    name,
    label,
    code,
    type,
    lat,
    lon,
    timezone,
    owner: db.collection("User").doc(userId),
    viewers: viewerRefs,
  };

  if (type === "fotovoltaico") {
    newPrototype.beta = typeof beta === "number" ? beta : 21;
  }

  const created = await db.collection("Prototype").add(newPrototype);

  return NextResponse.json({ id: created.id, code }, { status: 201 });
}