import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";
import { getPrototypeData } from "@/lib/prototype-data";
import { FrontendPrototype } from "@/lib/types/frontend-data-model";
import type { TimeWindowValue } from "@/lib/types/utility-types";
import { TimeWindow } from "@/lib/types/utility-types";
import { cookies } from "next/headers";

// POST /api/prototype/get_prototypes
export async function POST(req: NextRequest) {
  // Obtener usuario actual
  const cookieStore = await cookies();
  const userId = cookieStore.get("session_user_id")?.value;
  if (!userId) return NextResponse.json({ prototypes: [] }, { status: 200 });

  const userDoc = await db.collection("User").doc(userId).get();
  const isAdmin = userDoc.data()?.role === "admin";
  const userRef = db.collection("User").doc(userId);

  // Obtener todos los prototipos y filtrar por acceso
  const prototypesSnap = await db.collection("Prototype").get();
  const VISIBLE_TIME_WINDOW: TimeWindowValue = TimeWindow.sm;
  const PADDED_TIME_WINDOW: TimeWindowValue = TimeWindow.md;
  const endDate = new Date();

  // Filtrar: admin ve todos, resto solo los suyos o donde es viewer
  const accessibleDocs = prototypesSnap.docs.filter((doc) => {
    if (isAdmin) return true;
    const d = doc.data();
    const ownerRef = d.owner as admin.firestore.DocumentReference;
    if (ownerRef?.id === userId) return true;
    const viewers = (d.viewers ?? []) as admin.firestore.DocumentReference[];
    return viewers.some((v) => v.id === userId);
  });

  const prototypes: FrontendPrototype[] = await Promise.all(
    accessibleDocs.map(async (doc) => {
      const d = doc.data();
      const ownerRef = d.owner as admin.firestore.DocumentReference;
      const ownerSnap = await ownerRef.get();
      const ownerData = ownerSnap.data();

      const viewers = (d.viewers ?? []) as admin.firestore.DocumentReference[];
      const viewerIds = viewers.map((v) => v.id);

      const startDate = new Date(endDate.getTime() - PADDED_TIME_WINDOW * 60 * 60 * 1_000);
      const prototypeData = await getPrototypeData(doc.id, startDate, endDate);

      const protoType = (d.type ?? "fotovoltaico") as "fotovoltaico" | "eolico";

      const frontendPrototype: FrontendPrototype = {
        id: doc.id,
        name: d.name ?? "",
        label: d.label,
        type: protoType,
        ownerId: ownerRef.id,
        owner: {
          name: ownerData?.name ?? "",
          full_name: `${ownerData?.name ?? ""} ${ownerData?.last_name ?? ""}`.trim(),
          profile_picture: ownerData?.profile_picture ?? "",
        },
        viewerIds,
        solarConfig: protoType === "fotovoltaico" ? {
          lat:      typeof d.lat      === "number" ? d.lat      : 20.36725,
          lon:      typeof d.lon      === "number" ? d.lon      : -100.0102,
          timezone: typeof d.timezone === "number" ? d.timezone : -6,
          beta:     typeof d.beta     === "number" ? d.beta     : 21,
        } : undefined,
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