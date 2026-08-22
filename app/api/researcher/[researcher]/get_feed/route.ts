import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { db } from "@/lib/firebase-admin";
import { assertPrototypeAccess } from "@/lib/get-accessible-prototypes";

const CHATS_PER_BATCH = parseInt(process.env.CHATS_PER_BATCH_OF_FEED ?? "20");

// POST /api/researcher/[researcher]/get_feed
export async function POST(
  req: NextRequest,
  { params }: { params: { researcher: string } }
) {
  const { researcher } = await params;
  const { latest_chat_id, prototype_id } = await req.json();

  const researcherRef = db.collection("User").doc(researcher);
  const researcherSnap = await researcherRef.get();
  if (!researcherSnap.exists) {
    return NextResponse.json({ error: "Researcher not found" }, { status: 404 });
  }

  if (!prototype_id) {
    return NextResponse.json({ chats: [] }, { status: 200 });
  }

  const access = await assertPrototypeAccess(researcher, prototype_id);
  if (!access.exists) {
    return NextResponse.json({ error: "Prototype not found" }, { status: 404 });
  }
  if (!access.allowed) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const prototypeRef = db.collection("Prototype").doc(prototype_id);

  // ── 1. Fetch the raw chat batch, filtrado por prototipo ──────────────────

  let query = db
    .collection("Chat")
    .where("prototype", "==", prototypeRef)
    .orderBy("creation_date", "asc") as admin.firestore.Query;

  if (latest_chat_id) {
    const latestChatSnap = await db.collection("Chat").doc(latest_chat_id).get();
    if (!latestChatSnap.exists) {
      return NextResponse.json(
        { error: "Reference chat not found" },
        { status: 404 }
      );
    }
    query = query.where(
      "creation_date",
      ">=",
      latestChatSnap.data()!.creation_date
    );
  }

  const snapshot = await query.limit(CHATS_PER_BATCH + 1).get();

  const chatDocs = snapshot.docs
    .filter((d) => d.id !== latest_chat_id)
    .slice(0, CHATS_PER_BATCH);

  if (chatDocs.length === 0) {
    return NextResponse.json({ chats: [] }, { status: 200 });
  }

  // ── 2. Resolve creator, prototype, readings and first_comment in parallel ─

  const chatAsPostList = await Promise.all(
    chatDocs.map(async (chatDoc) => {
      const chat = chatDoc.data();

      const creatorRef = chat.creator as admin.firestore.DocumentReference;
      const chatPrototypeRef = chat.prototype as
        | admin.firestore.DocumentReference
        | undefined;
      const firstCommentRef = chat.first_comment as admin.firestore.DocumentReference;

      const [creatorSnap, prototypeSnap, readingsSnap, firstCommentSnap] =
        await Promise.all([
          creatorRef.get(),
          chatPrototypeRef ? chatPrototypeRef.get() : Promise.resolve(null),
          chatDoc.ref.collection("readings").get(),
          firstCommentRef.get(),
        ]);

      const creator = creatorSnap.data() ?? {};

      const readings = readingsSnap.docs.map((r) => {
        const d = r.data();
        return {
          id: r.id,
          date: (d.date as admin.firestore.Timestamp).toDate().toISOString(),
          current: d.current as number,
          voltage: d.voltage as number,
          irradiance: d.irradiance as number,
        };
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        chat: chatDoc.id,
        prototype: chatPrototypeRef?.id ?? null,
        creation_date: (chat.creation_date as admin.firestore.Timestamp)
          .toDate()
          .toISOString(),
        creator: {
          name: creator.name as string,
          last_name: creator.last_name as string,
          degree: creator.degree as string,
          timezone: creator.timezone as string,
          profile_picture: creator.profile_picture as string,
        },
        commenters: (
          chat.commenters as admin.firestore.DocumentReference[]
        ).map((ref) => ref.id),
        followers: (
          chat.followers as admin.firestore.DocumentReference[]
        ).map((ref) => ref.id),
        readings,
        prototype_name: prototypeSnap?.data()?.name ?? null,
        first_comment_text: firstCommentSnap.data()?.text ?? null,
        highlight_start: firstCommentSnap.data()?.highlight_start
          ? (firstCommentSnap.data()!.highlight_start as admin.firestore.Timestamp).toDate().toISOString()
          : null,
        highlight_end: firstCommentSnap.data()?.highlight_end
          ? (firstCommentSnap.data()!.highlight_end as admin.firestore.Timestamp).toDate().toISOString()
          : null,
      };
    })
  );

  const sortedChats = chatAsPostList.sort(
    (a, b) =>
      new Date(b.creation_date).getTime() - new Date(a.creation_date).getTime()
  );

  return NextResponse.json({ chats: sortedChats }, { status: 200 });
}