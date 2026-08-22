import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

// POST /api/researcher/[researcher]/read_all_notifications
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

  const unreadSnap = await db
    .collection("Notification")
    .where("user", "==", researcherRef)
    .where("has_been_read", "==", false)
    .get();

  const batch = db.batch();
  unreadSnap.docs.forEach((doc) => batch.update(doc.ref, { has_been_read: true }));
  await batch.commit();

  return NextResponse.json({ ok: true, updated: unreadSnap.size }, { status: 200 });
}