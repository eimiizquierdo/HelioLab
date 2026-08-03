import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

// POST /api/researcher/[researcher]/get_notifications
export async function POST(
  req: NextRequest,
  { params }: { params: { researcher: string } }
) {
  const { researcher } = await params;

  const researcherRef = db.collection("User").doc(researcher);
  const researcherSnap = await researcherRef.get();
  if (!researcherSnap.exists) {
    return NextResponse.json({ error: "Researcher not found" }, { status: 404 });
  }

  try {
    const snapshot = await db
      .collection("Notification")
      .where("user", "==", researcherRef)
      .orderBy("creation_date", "asc")
      .get();

    const notifications = snapshot.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        ...data,
        creation_date: data.creation_date?.toDate?.()?.toISOString?.() ?? data.creation_date,
        read_date: data.read_date?.toDate?.()?.toISOString?.() ?? data.read_date ?? null,
        // Convertir referencias a IDs
        user: typeof data.user?.id === "string" ? data.user.id : data.user,
        followed_chat: data.followed_chat
          ? (typeof data.followed_chat?.id === "string" ? data.followed_chat.id : data.followed_chat)
          : null,
      }
    });

    return NextResponse.json({ notifications }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("get_notifications error:", message)
    // Si es error de índice faltante, devolver vacío en lugar de 500
    if (message.includes("index") || message.includes("Index")) {
      return NextResponse.json({ notifications: [] }, { status: 200 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}