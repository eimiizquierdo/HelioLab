import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getPrototypeData } from "@/lib/prototype-data";

// POST /prototype/get_all_prototypes_latest_data
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({}));
    const { start_date } = body;

    let startDate: Date | undefined;
    if (start_date != null) {
      startDate = new Date(start_date);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid start_date format. Expected ISO 8601 string." },
          { status: 400 },
        );
      }
    }

    const prototypesSnap = await db.collection("Prototype").get();

    const results = await Promise.all(
      prototypesSnap.docs.map((doc) => getPrototypeData(doc.id, startDate)),
    );

    return NextResponse.json({ prototypes: results }, { status: 200 });
  } catch (error) {
    console.error("[get_all_prototypes_latest_data]", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}