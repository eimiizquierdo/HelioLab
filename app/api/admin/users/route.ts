import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

async function requireAdmin() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("session_user_id")?.value;
  if (!userId) return null;
  const doc = await db.collection("User").doc(userId).get();
  if (!doc.exists || doc.data()?.role !== "admin") return null;
  return userId;
}

// GET /api/admin/users — listar todos los usuarios
export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const snap = await db.collection("User").get();
  const users = snap.docs.map((doc) => {
    const { hashed_password, ...rest } = doc.data();
    return { id: doc.id, ...rest };
  });

  return NextResponse.json({ users }, { status: 200 });
}

// POST /api/admin/users — crear usuario
export async function POST(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { name, last_name, email, degree, timezone, password, role } = await req.json();

  if (!name || !last_name || !email || !degree || !timezone || !password) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  // Verificar que el email no exista
  const existing = await db.collection("User").where("email", "==", email).get();
  if (!existing.empty) {
    return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
  }

  const hashed_password = await bcrypt.hash(password, 10);
  const now = new Date();

  const docRef = await db.collection("User").add({
    name,
    last_name,
    email,
    degree,
    timezone: timezone ?? "UTC-06:00",
    role: role ?? "user",
    hashed_password,
    profile_picture: "",
    last_chat_seen_time: now,
    last_interaction_time: now,
  });

  return NextResponse.json({ id: docRef.id }, { status: 201 });
}