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
      // Convertir Timestamps de Firestore a strings ISO
      creation_date: data.creation_date?.toDate?.()?.toISOString?.() ?? data.creation_date,
      read_date: data.read_date?.toDate?.()?.toISOString?.() ?? data.read_date ?? null,
    }
  });

  return NextResponse.json({ notifications }, { status: 200 });
}