import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

// POST /api/researcher/[researcher]/read_notification
export async function POST(
  req: NextRequest,
  { params }: { params: { researcher: string } }
) {
  const { researcher } = await params;
  const { notification } = await req.json();

  if (!notification) {
    return NextResponse.json(
      { error: "notification id is required" },
      { status: 400 }
    );
  }

  // Verify the researcher exists
  const researcherRef = db.collection("User").doc(researcher);
  const researcherSnap = await researcherRef.get();
  if (!researcherSnap.exists) {
    return NextResponse.json({ error: "Researcher not found" }, { status: 404 });
  }

  // Fetch the notification
  const notificationRef = db.collection("Notification").doc(notification);
  const notificationSnap = await notificationRef.get();
  if (!notificationSnap.exists) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  const notificationData = notificationSnap.data()!;

  // Ensure the notification belongs to this researcher
  if (notificationData.user.id !== researcher) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await notificationRef.update({ has_been_read: true });

  return new NextResponse(null, { status: 200 });
}