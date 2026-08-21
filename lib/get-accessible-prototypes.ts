// lib/get-accessible-prototypes.ts
// Carga prototipos directamente desde Firestore (sin fetch)
// para evitar perder cookies en llamadas server-to-server

import { db } from "@/lib/firebase-admin"
import * as admin from "firebase-admin"
import { getPrototypeData } from "@/lib/prototype-data"
import type { FrontendPrototype } from "@/lib/types/frontend-data-model"
import { TimeWindow } from "@/lib/types/utility-types"
import type { TimeWindowValue } from "@/lib/types/utility-types"

export type PrototypeAccess = {
  isAdmin: boolean
  isOwner: boolean
  isViewer: boolean
  hasAccess: boolean
}

export function checkPrototypeAccess(
  userId: string,
  isAdmin: boolean,
  prototypeData: FirebaseFirestore.DocumentData,
): PrototypeAccess {
  const ownerRef = prototypeData.owner as admin.firestore.DocumentReference | undefined
  const isOwner = ownerRef?.id === userId
  const viewers = (prototypeData.viewers ?? []) as admin.firestore.DocumentReference[]
  const isViewer = viewers.some((v) => v?.id === userId)
  return { isAdmin, isOwner, isViewer, hasAccess: isAdmin || isOwner || isViewer }
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const userDoc = await db.collection("User").doc(userId).get()
  return userDoc.data()?.role === "admin"
}

async function getAccessibleDocs(userId: string, isAdmin: boolean) {
  const prototypesSnap = await db.collection("Prototype").get()
  return prototypesSnap.docs.filter((doc) => checkPrototypeAccess(userId, isAdmin, doc.data()).hasAccess)
}

export async function getAccessiblePrototypeDocs(userId: string) {
  const isAdmin = await isUserAdmin(userId)
  return getAccessibleDocs(userId, isAdmin)
}

export async function getAccessiblePrototypeIds(userId: string): Promise<string[]> {
  const docs = await getAccessiblePrototypeDocs(userId)
  return docs.map((d) => d.id)
}

export type AssertAccessResult =
  | { exists: false; allowed: false }
  | { exists: true; allowed: boolean }

/** Guarda de acceso para rutas por-prototipo (get_latest_data, get_data_in_range, get_highlights). */
export async function assertPrototypeAccess(
  userId: string | undefined,
  prototypeId: string,
): Promise<AssertAccessResult> {
  const protoDoc = await db.collection("Prototype").doc(prototypeId).get()
  if (!protoDoc.exists) return { exists: false, allowed: false }
  if (!userId) return { exists: true, allowed: false }

  const isAdmin = await isUserAdmin(userId)
  const { hasAccess } = checkPrototypeAccess(userId, isAdmin, protoDoc.data()!)
  return { exists: true, allowed: hasAccess }
}

/**
 * Carga los prototipos accesibles directamente desde Firestore, ya
 * hidratados a FrontendPrototype. Úsala desde Server Components
 * (como app/(app)/page.tsx) en vez de client-api.getPrototypes(),
 * que hace un fetch server-to-server y pierde las cookies de sesión.
 */
export async function getAccessiblePrototypes(
  userId: string,
  isAdmin: boolean,
): Promise<FrontendPrototype[]> {
  const VISIBLE_TIME_WINDOW: TimeWindowValue = TimeWindow.sm
  const PADDED_TIME_WINDOW: TimeWindowValue = TimeWindow.md
  const endDate = new Date()

  const accessibleDocs = await getAccessibleDocs(userId, isAdmin)

  return Promise.all(
    accessibleDocs.map(async (doc) => {
      const d = doc.data()
      const ownerRef = d.owner as admin.firestore.DocumentReference
      const ownerSnap = await ownerRef.get()
      const ownerData = ownerSnap.data()

      const viewers = (d.viewers ?? []) as admin.firestore.DocumentReference[]
      const viewerIds = viewers.map((v) => v.id)

      const startDate = new Date(endDate.getTime() - PADDED_TIME_WINDOW * 60 * 60 * 1_000)
      const prototypeData = await getPrototypeData(doc.id, startDate, endDate)

      const protoType = (d.type ?? "fotovoltaico") as "fotovoltaico" | "eolico"

      return {
        id: doc.id,
        name: d.name ?? "",
        label: d.label ?? "",
        type: protoType,
        ownerId: ownerRef.id,
        owner: {
          name: ownerData?.name ?? "",
          full_name: `${ownerData?.name ?? ""} ${ownerData?.last_name ?? ""}`.trim(),
          profile_picture: ownerData?.profile_picture ?? "",
        },
        viewerIds,
        solarConfig: protoType === "fotovoltaico"
          ? {
              lat:      typeof d.lat      === "number" ? d.lat      : 20.36725,
              lon:      typeof d.lon      === "number" ? d.lon      : -100.0102,
              timezone: typeof d.timezone === "number" ? d.timezone : -6,
              beta:     typeof d.beta     === "number" ? d.beta     : 21,
            }
          : undefined,
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
      } satisfies FrontendPrototype
    })
  )
}