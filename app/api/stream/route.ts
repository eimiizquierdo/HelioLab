import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import type { Timestamp } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/stream?since=<ISO>
// Server-Sent Events: emite readings nuevos de todos los prototipos
// Un solo onSnapshot por prototipo compartido entre todos los clientes
export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get("since");
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 60_000);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // cliente desconectado
        }
      };

      // Heartbeat cada 25s para mantener la conexión viva en Vercel
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      // Cargar todos los prototipos y abrir un listener por cada uno
      const prototypesSnap = await db.collection("Prototype").get().catch(() => null);
      if (!prototypesSnap) {
        clearInterval(heartbeat);
        controller.close();
        return;
      }

      const unsubscribers: (() => void)[] = [];

      prototypesSnap.docs.forEach((protoDoc) => {
        const protoId = protoDoc.id;

        const unsub = protoDoc.ref
          .collection("Reading")
          .orderBy("date", "asc")
          .startAfter(sinceDate)
          .onSnapshot(
            (snap) => {
              snap.docChanges().forEach((change) => {
                if (change.type !== "added") return;
                const d = change.doc.data();
                const date = (d.date as Timestamp).toDate();
                send(JSON.stringify({
                  prototype: protoId,
                  reading: {
                    id: change.doc.id,
                    date: date.toISOString(),
                    voltage: Number(d.voltage),
                    current: Number(d.current),
                    irradiance: Number(d.irradiance),
                  },
                }));
              });
            },
            (err) => {
              console.error(`[SSE] onSnapshot error prototipo ${protoId}:`, err);
            }
          );

        unsubscribers.push(unsub);
      });

      // Limpiar cuando el cliente se desconecte
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribers.forEach((u) => u());
        try { controller.close(); } catch { /* ya cerrado */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}