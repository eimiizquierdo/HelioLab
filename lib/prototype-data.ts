import { db } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { ChatAsHighlight, PrototypeData } from "./types/frontend-data-model";

/**
 * Returns the {PrototypeData} of a prototype, using the current timestamp
 * as the upper bound for the `date`/`creation` property of the data to be 
 * fetched. The lower bound is set to current timestamp minus `timeWindow`
 * number of hours
 * @param prototypeId 
 * @param startDate
 * @param endDate
 * @returns 
 */
export async function getPrototypeData(
  prototypeId: string,
  startDate: Date,
  endDate: Date,
): Promise<PrototypeData> {
  const prototypeRef = db.collection("Prototype").doc(prototypeId);

  const readingsQuery = prototypeRef
    .collection("Reading")
    .orderBy("date", "asc")
    .startAt(Timestamp.fromDate(startDate))
    .endBefore(Timestamp.fromDate(endDate));

  const highlightsQuery = db
    .collection("Comment")
    .where("highlight_end", ">=", Timestamp.fromDate(startDate))
    .where("highlight_end", "<", Timestamp.fromDate(endDate))
    .orderBy("highlight_end", "asc");

  const [readingsSnap, highlightsSnap] = await Promise.all([
    readingsQuery.get(),
    highlightsQuery.get(),
  ]);

  const readings = readingsSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      date: (d.date as Timestamp).toDate(),
      current: d.current as number,
      voltage: d.voltage as number,
      irradiance: d.irradiance as number,
    };
  });

  const highlightsSieve: boolean[] = await Promise.all(
    highlightsSnap.docs.map(async (doc) => {
      const data = doc.data();
      const chatDoc = await data.chat.get();
      const chatsPrototype: string = chatDoc.data()!.prototype.id;
      return chatsPrototype === prototypeId;
    })
  );
  const filteredHighlights = highlightsSnap.docs.filter((_, i) => highlightsSieve[i]);

  const highlights: ChatAsHighlight[] = filteredHighlights.map((doc) => {
    const data = doc.data();
    const creatorData = data.creator_data as
      | { name: string; profile_picture: string }
      | undefined;

    return {
      chat: doc.id,
      creator_profile_picture: (creatorData?.profile_picture ?? "") as string,
      creator: creatorData
        ? { name: creatorData.name, profile_picture: creatorData.profile_picture }
        : undefined,
      start_date: new Date(Math.max(
        (data.highlight_start as Timestamp).toDate().getTime(),
        startDate.getTime()
      )),
      end_date: (data.highlight_end as Timestamp).toDate(),
    };
  });

  return {
    prototype: prototypeId,
    readings,
    highlights,
    cursor: endDate,
    time_window: (endDate.getTime() - startDate.getTime()) / (60 * 60 * 1000),
  };
}