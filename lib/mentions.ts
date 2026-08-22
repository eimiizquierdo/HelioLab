// lib/mentions.ts
//
// Deteccion de menciones "@Nombre Apellido" dentro de un texto de comentario.
// No hay autocompletado en la UI todavia: el usuario escribe la mencion a mano
// y aqui se compara (sin distinguir mayusculas/acentos de caja) contra los
// nombres completos reales para resolver a quien notificar.

import { db } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

const MENTION_REGEX = /@([\p{L}]+(?:\s[\p{L}]+){0,3})/gu;

export async function extractMentionedUserRefs(
  text: string,
  excludeUserId?: string,
): Promise<admin.firestore.DocumentReference[]> {
  const matches = [...text.matchAll(MENTION_REGEX)].map((m) => m[1].trim().toLowerCase());
  if (matches.length === 0) return [];

  const usersSnap = await db.collection("User").get();
  const found = new Map<string, admin.firestore.DocumentReference>();

  for (const doc of usersSnap.docs) {
    if (doc.id === excludeUserId) continue;
    const d = doc.data();
    const fullName = `${d.name ?? ""} ${d.last_name ?? ""}`.trim().toLowerCase();
    if (!fullName) continue;
    if (matches.some((m) => fullName === m || fullName.startsWith(m))) {
      found.set(doc.id, doc.ref);
    }
  }

  return [...found.values()];
}