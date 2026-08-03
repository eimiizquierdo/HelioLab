import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { db } from "@/lib/firebase-admin";

// DELETE /api/researcher/[researcher]/unfollow_chat
export async function DELETE(
  req: NextRequest,
  { params }: { params: { researcher: string } }
) {
  const { researcher } = await params;
  const { chat } = await req.json();

  if (!chat) {
    return NextResponse.json({ error: "chat is required" }, { status: 400 });
  }

  const researcherRef = db.collection("User").doc(researcher);
  const researcherSnap = await researcherRef.get();
  if (!researcherSnap.exists) {
    return NextResponse.json({ error: "Researcher not found" }, { status: 404 });
  }

  const chatRef = db.collection("Chat").doc(chat);

  // Eliminar el FollowedChat del usuario para este chat
  const followedSnap = await db
    .collection("FollowedChat")
    .where("owner", "==", researcherRef)
    .where("chat", "==", chatRef)
    .get();

  const batch = db.batch();
  followedSnap.docs.forEach((doc) => batch.delete(doc.ref));

  // Quitar al investigador del array followers del Chat
  batch.update(chatRef, {
    followers: admin.firestore.FieldValue.arrayRemove(researcherRef),
  });

  await batch.commit();

  return NextResponse.json({ ok: true }, { status: 200 });
}