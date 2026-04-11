import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getPrototypeData } from "@/lib/prototype-data";

// POST /prototype/get_all_prototypes_latest_data
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({}));
    const { start_date } = body;

    if (start_date === null || start_date === undefined) {
      return NextResponse.json(
        { error: "No start_date given. Expected ISO 8601 string" },
        { status: 400 }
      );
    }

    let startDate = new Date(start_date);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid start_date format. Expected ISO 8601 string." },
        { status: 400 },
      );
    }

    const endDate = new Date();
    const prototypesSnap = await db.collection("Prototype").get();

    console.log({ startDate: startDate.toLocaleString(), endDate: endDate.toLocaleString() });

    const results = await Promise.all(
      prototypesSnap.docs.map((doc) => getPrototypeData(doc.id, startDate, endDate)),
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