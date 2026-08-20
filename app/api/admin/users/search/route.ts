import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

// GET /api/admin/users/search?q=nombre
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("session_user_id")?.value;
  if (!userId) return NextResponse.json({ users: [] }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";
  if (q.length < 2) return NextResponse.json({ users: [] });

  const snap = await db.collection("User").get();
  const users = snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name ?? "",
        last_name: d.last_name ?? "",
        email: d.email ?? "",
        degree: d.degree ?? "",
        profile_picture: d.profile_picture ?? "",
      };
    })
    .filter((u) => {
      const full = `${u.name} ${u.last_name}`.toLowerCase();
      return full.includes(q) && u.id !== userId;
    })
    .slice(0, 10);

  return NextResponse.json({ users });
}