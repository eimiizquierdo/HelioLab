import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { db } from "@/lib/firebase-admin";

// POST /api/researcher/[researcher]/get_followed_chats
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

  const threeDaysAgo = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  );

  const activeChatsSnap = await db
    .collection("Chat")
    .where("last_message_time", ">=", threeDaysAgo)
    .get();

  if (activeChatsSnap.empty) {
    return NextResponse.json({ followed_chats: [] }, { status: 200 });
  }

  const activeChatRefs = activeChatsSnap.docs.map((d) =>
    db.collection("Chat").doc(d.id)
  );

  const BATCH_SIZE = 30;
  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < activeChatRefs.length; i += BATCH_SIZE) {
    const batch = activeChatRefs.slice(i, i + BATCH_SIZE);
    const followedSnap = await db
      .collection("FollowedChat")
      .where("owner", "==", researcherRef)
      .where("chat", "in", batch)
      .get();

    followedSnap.docs.forEach((doc) => {
      const d = doc.data();
      results.push({
        id: doc.id,
        creation_date: (d.creation_date as admin.firestore.Timestamp).toDate().toISOString(),
        owner: (d.owner as admin.firestore.DocumentReference).id,
        chat: (d.chat as admin.firestore.DocumentReference).id,
        name: d.name,
        // last_message_seen_time puede ser null (chats recién creados)
        last_message_seen_time: d.last_message_seen_time
          ? (d.last_message_seen_time as admin.firestore.Timestamp).toDate().toISOString()
          : null,
        silenced: d.silenced,
      });
    });
  }

  return NextResponse.json({ followed_chats: results }, { status: 200 });
}