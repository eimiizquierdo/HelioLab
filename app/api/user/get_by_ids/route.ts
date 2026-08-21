import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

// POST /api/user/get_by_ids
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("session_user_id")?.value;
  if (!userId) return NextResponse.json({ users: [] }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];

  if (ids.length === 0) return NextResponse.json({ users: [] });

  const refs = ids.map((id: string) => db.collection("User").doc(id));
  const snaps = await db.getAll(...refs);

  const users = snaps
    .filter((snap) => snap.exists)
    .map((snap) => {
      const d = snap.data()!;
      return {
        id: snap.id,
        name: d.name ?? "",
        last_name: d.last_name ?? "",
        email: d.email ?? "",
        degree: d.degree ?? "",
        profile_picture: d.profile_picture ?? "",
      };
    });

  return NextResponse.json({ users });
}