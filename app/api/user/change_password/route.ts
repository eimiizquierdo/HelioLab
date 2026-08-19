import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

// POST /api/user/change_password
export async function POST(req: NextRequest) {
  // Obtener usuario de la sesión
  const cookieStore = await cookies();
  const userId = cookieStore.get("session_user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { current_password, new_password } = await req.json();

  if (!current_password || !new_password) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  if (new_password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  const userDoc = await db.collection("User").doc(userId).get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const userData = userDoc.data()!;

  // Verificar contraseña actual
  const match = await bcrypt.compare(current_password, userData.hashed_password);
  if (!match) {
    return NextResponse.json({ error: "La contraseña actual es incorrecta" }, { status: 400 });
  }

  // Hashear nueva contraseña y guardar
  const hashed = await bcrypt.hash(new_password, 10);
  await db.collection("User").doc(userId).update({ hashed_password: hashed });

  return NextResponse.json({ ok: true }, { status: 200 });
}