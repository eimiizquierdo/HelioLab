import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isUserAdmin, getAccessiblePrototypes } from "@/lib/get-accessible-prototypes";

// POST /api/prototype/get_prototypes
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("session_user_id")?.value;
  if (!userId) return NextResponse.json({ prototypes: [] }, { status: 200 });

  const isAdmin = await isUserAdmin(userId);
  const prototypes = await getAccessiblePrototypes(userId, isAdmin);

  return NextResponse.json({ prototypes }, { status: 200 });
}