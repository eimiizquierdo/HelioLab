import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { db } from "@/lib/firebase-admin";

// POST /api/researcher/[researcher]/follow_chat
export async function POST(
  req: NextRequest,
  { params }: { params: { researcher: string } }
) {
  const { researcher } = await params;
  const { chat, name } = await req.json();

  if (!chat) {
    return NextResponse.json({ error: "chat is required" }, { status: 400 });
  }
  if (name === undefined || name === null) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const researcherRef = db.collection("User").doc(researcher);
  const researcherSnap = await researcherRef.get();
  if (!researcherSnap.exists) {
    return NextResponse.json({ error: "Researcher not found" }, { status: 404 });
  }

  const chatRef = db.collection("Chat").doc(chat);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const now = admin.firestore.Timestamp.now();

  // Create the FollowedChat entity
  const followedChatRef = await db.collection("FollowedChat").add({
    creation_date: now,
    owner: researcherRef,
    chat: chatRef,
    name: name,
    last_message_seen_time: null,
    silenced: false,
  });

  // Add the researcher to the chat's followers array
  await chatRef.update({
    followers: admin.firestore.FieldValue.arrayUnion(researcherRef),
  });

  return NextResponse.json(
    { followed_chat_id: followedChatRef.id },
    { status: 201 }
  );
}