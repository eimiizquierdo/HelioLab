import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import type { ChatAsMessage } from "@/lib/types/frontend-data-model";

const MESSAGE_BATCH_SIZE = process.env.MESSAGE_BATCH_SIZE
  ? parseInt(process.env.MESSAGE_BATCH_SIZE)
  : 30;

export async function POST(
  request: NextRequest,
  { params }: { params: { chat: string } },
) {
  const { chat: chatId } = await params;

  let researcherId: string;
  let limitDate: string | null = null;

  try {
    const body = await request.json();
    researcherId = body.researcher;
    limitDate = body.limit_date ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!researcherId) {
    return NextResponse.json(
      { error: "Missing required parameter: researcher" },
      { status: 400 },
    );
  }

  const db = getFirestore();

  const chatRef = db.collection("Chat").doc(chatId);
  const chatSnap = await chatRef.get();

  if (!chatSnap.exists) {
    return NextResponse.json({ messages: [] }, { status: 200 });
  }

  let query = db
    .collection("Comment")
    .where("chat", "==", chatRef)
    .orderBy("creation_date", "desc")
    .limit(MESSAGE_BATCH_SIZE);

  if (limitDate) {
    const limitTimestamp = new Date(limitDate);
    if (isNaN(limitTimestamp.getTime())) {
      return NextResponse.json(
        { error: "Invalid limit_date format. Expected ISO 8601." },
        { status: 400 },
      );
    }
    query = query.where("creation_date", "<", limitTimestamp);
  }

  const commentsSnap = await query.get();

  const messages: ChatAsMessage[] = await Promise.all(
    commentsSnap.docs.map(async (doc) => {
      const data = doc.data();

      const authorRef = data.author;
      const authorSnap = await authorRef.get();
      const authorData = authorSnap.exists ? authorSnap.data() : null;

      return {
        text: data.text,
        author: {
          full_name: data.full_name,
          degree: data.degree,
          timezone: authorData?.timezone ?? "",
          profile_picture: authorData?.profile_picture ?? "",
        },
        creation_time: data.creation_date,
        is_myself: authorRef.id === researcherId,
      } satisfies ChatAsMessage;
    }),
  );

  return NextResponse.json({ messages });
}