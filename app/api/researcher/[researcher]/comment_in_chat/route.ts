import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { db } from "@/lib/firebase-admin";
import { extractMentionedUserRefs } from "@/lib/mentions";

// POST /api/researcher/[researcher]/comment_in_chat
export async function POST(
  req: NextRequest,
  { params }: { params: { researcher: string } }
) {
  const { researcher } = await params;
  const { chat, comment } = await req.json();

  if (!chat) {
    return NextResponse.json({ error: "chat is required" }, { status: 400 });
  }
  if (!comment || !comment.trim()) {
    return NextResponse.json(
      { error: "comment must be a non-empty, non-whitespace string" },
      { status: 400 }
    );
  }

  // Fetch researcher
  const researcherRef = db.collection("User").doc(researcher);
  const researcherSnap = await researcherRef.get();
  if (!researcherSnap.exists) {
    return NextResponse.json({ error: "Researcher not found" }, { status: 404 });
  }
  const researcherData = researcherSnap.data()!;
  const fullName = `${researcherData.name} ${researcherData.last_name}`;

  // Fetch the chat
  const chatRef = db.collection("Chat").doc(chat);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
  const chatData = chatSnap.data()!;

  const now = admin.firestore.Timestamp.now();

  // --- Step 1: Create the Comment ---
  const commentRef = await db.collection("Comment").add({
    chat: chatRef,
    full_name: fullName,
    degree: researcherData.degree,
    creation_date: now,
    author: researcherRef,
    text: comment,
  });

  // --- Step 2: Add researcher to the chat's commenters list ---
  await chatRef.update({
    commenters: admin.firestore.FieldValue.arrayUnion(researcherRef),
  });

  // --- Step 3: Upsert FollowedChat for the commenter ---
  const existingFollowSnap = await db
    .collection("FollowedChat")
    .where("owner", "==", researcherRef)
    .where("chat", "==", chatRef)
    .get();

  if (existingFollowSnap.empty) {
    await db.collection("FollowedChat").add({
      creation_date: now,
      owner: researcherRef,
      chat: chatRef,
      name: "",
      last_message_seen_time: now,
      silenced: false,
    });
  } else {
    await existingFollowSnap.docs[0].ref.update({
      last_message_seen_time: now,
    });
  }

  // --- Step 4: Notificar a comentaristas y seguidores del chat (menos el autor) ---
  const commentersRefs: admin.firestore.DocumentReference[] =
    chatData.commenters ?? [];
  const followersRefs: admin.firestore.DocumentReference[] =
    chatData.followers ?? [];

  const notifyRefs = new Map<string, admin.firestore.DocumentReference>();
  for (const ref of [...commentersRefs, ...followersRefs]) {
    if (ref.id !== researcher) notifyRefs.set(ref.id, ref);
  }

  for (const userRef of notifyRefs.values()) {
    await db.collection("Notification").add({
      type: "new_comment_followed",
      has_been_read: false,
      text: `${fullName} comentó en un chat que sigues`,
      chat: chatRef,
      user: userRef,
      creation_date: now,
    });
  }

  // --- Step 5: Notificar menciones (@Nombre Apellido) dentro del texto ---
  const mentionedRefs = await extractMentionedUserRefs(comment, researcher);
  for (const userRef of mentionedRefs) {
    await db.collection("Notification").add({
      type: "mention",
      has_been_read: false,
      text: `${fullName} te mencionó en un comentario`,
      chat: chatRef,
      user: userRef,
      creation_date: now,
    });
  }

  // --- Step 6: Update last_message_time on the chat ---
  await chatRef.update({ last_message_time: now });

  return NextResponse.json({ comment_id: commentRef.id }, { status: 201 });
}