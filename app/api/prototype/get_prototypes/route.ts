import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";
import { getPrototypeData } from "@/lib/prototype-data";
import { FrontendPrototype, PrototypeData } from "@/lib/types/frontend-data-model";
import type { TimeWindowValue } from "@/lib/types/utility-types";
import { TimeWindow } from "@/lib/types/utility-types";

// POST /api/prototype/get_prototypes
export async function POST(req: NextRequest) {
  const prototypesSnap = await db.collection("Prototype").get();
  const VISIBLE_TIME_WINDOW: TimeWindowValue = TimeWindow.sm;
  const PADDED_TIME_WINDOW: TimeWindowValue = TimeWindow.md;

  const endDate = new Date();
  const prototypes: FrontendPrototype[] = await Promise.all(
    prototypesSnap.docs.map(async (doc) => {
      const d = doc.data();

      // Resolve owner reference → User document
      const ownerRef = d.owner as admin.firestore.DocumentReference;
      const ownerSnap = await ownerRef.get();
      const ownerData = ownerSnap.data();

      const startDate = new Date(endDate.getTime() - PADDED_TIME_WINDOW * 60 * 60 * 1_000);
      const prototypeData = await getPrototypeData(doc.id, startDate, endDate);

      const frontendPrototype: FrontendPrototype = {
        id: doc.id,
        label: d.label,
        owner: {
          name: ownerData?.name ?? "",
          full_name: `${ownerData?.name ?? ""} ${ownerData?.last_name ?? ""}`.trim(),
          profile_picture: ownerData?.profile_picture ?? "",
        },
        is_loading: false,
        data: {
          window_upper_bound: prototypeData.cursor,
          window_lower_bound: new Date(prototypeData.cursor.getTime() - PADDED_TIME_WINDOW * 60 * 60 * 1000),
          cursor: prototypeData.cursor,
          cursor_updates_automatically: true,

          time_window: VISIBLE_TIME_WINDOW,
          readings: prototypeData.readings,
          highlights: prototypeData.highlights,
        },
      };
      return frontendPrototype;
    })
  );

  return NextResponse.json({ prototypes }, { status: 200 });
}