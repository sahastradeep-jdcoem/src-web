import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/config";
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  writeBatch, 
  serverTimestamp 
} from "firebase/firestore";
import { CouncilTenure } from "@/lib/tenureStore";
import { EventItem, TeamMember, ClubItem } from "@/types";
import { cleanUndefined, getEventDocId } from "@/lib/firebase/firestore";
import { parseDateStringToTimestamp } from "@/lib/eventsStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetTenureId, tenureBeginDate } = body;

    if (!targetTenureId || typeof targetTenureId !== "string") {
      return NextResponse.json(
        { success: false, error: "Target tenure ID is required." },
        { status: 400 }
      );
    }

    if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Firestore backend is not configured." },
        { status: 500 }
      );
    }

    // 1. Fetch council_tenures
    const tenuresDocRef = doc(db, "site_content", "council_tenures");
    const tenuresSnap = await getDoc(tenuresDocRef);
    if (!tenuresSnap.exists() || !tenuresSnap.data()?.payload) {
      return NextResponse.json(
        { success: false, error: "Council tenures registry not found in database." },
        { status: 404 }
      );
    }

    const tenures: CouncilTenure[] = tenuresSnap.data().payload;
    const targetTenure = tenures.find((t) => t.id === targetTenureId);

    if (!targetTenure) {
      return NextResponse.json(
        { success: false, error: `Tenure with ID [${targetTenureId}] was not found.` },
        { status: 404 }
      );
    }

    const currentlyActive = tenures.find((t) => t.isCurrent || t.status === "active");
    const wasDraft = targetTenure.isDraft || targetTenure.status === "draft";

    const beginIso = tenureBeginDate 
      ? new Date(tenureBeginDate).toISOString() 
      : new Date().toISOString();
    const beginTs = new Date(beginIso).getTime();

    // Directive: Old tenure end date is one day before the next tenure commence date
    const beginDateObj = new Date(beginIso);
    const oneDayBefore = new Date(beginDateObj);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    oneDayBefore.setHours(23, 59, 59, 999);
    const oldTenureEndDateIso = oneDayBefore.toISOString();

    // 2. Fetch current active council, hosting, and clubs to archive into previous tenure
    let currentCouncil: TeamMember[] = [];
    let currentHosting: TeamMember[] = [];
    let currentClubs: ClubItem[] = [];

    try {
      const cSnap = await getDoc(doc(db, "site_content", "council_team"));
      if (cSnap.exists() && cSnap.data()?.payload) currentCouncil = cSnap.data().payload;

      const hSnap = await getDoc(doc(db, "site_content", "hosting_committee"));
      if (hSnap.exists() && hSnap.data()?.payload) currentHosting = hSnap.data().payload;

      const clSnap = await getDoc(doc(db, "site_content", "clubs"));
      if (clSnap.exists() && clSnap.data()?.payload) currentClubs = clSnap.data().payload;
    } catch (e) {
      console.warn("Could not fetch active collections for snapshot:", e);
    }

    // 3. Fetch all events to partition and stamp
    const eventsSnap = await getDocs(collection(db, "events"));
    const allEvents: EventItem[] = [];
    eventsSnap.forEach((d) => {
      if (d.exists()) allEvents.push(d.data() as EventItem);
    });

    const pastEventsForArchive: EventItem[] = [];
    const futureOrCurrentEventsForTarget: EventItem[] = [];
    const eventsToUpdateInFirestore: EventItem[] = [];

    const outgoingTenureId = currentlyActive?.id || "tenure-archived";
    const outgoingTenureLabel = currentlyActive?.label || "Past Tenure";
    const targetTenureLabel = targetTenure.label;

    for (const e of allEvents) {
      const targetDateStr = e.rawDate || e.date;
      const evTs = targetDateStr ? parseDateStringToTimestamp(targetDateStr) : null;

      if (evTs !== null && evTs >= beginTs) {
        // Belongs to incoming active tenure
        const updatedEvt: EventItem = {
          ...e,
          tenureId: targetTenureId,
          tenureLabel: targetTenureLabel,
        };
        futureOrCurrentEventsForTarget.push(updatedEvt);
        if (e.tenureId !== targetTenureId || e.tenureLabel !== targetTenureLabel) {
          eventsToUpdateInFirestore.push(updatedEvt);
        }
      } else {
        // Belongs to outgoing tenure
        const stampedId = e.tenureId || outgoingTenureId;
        const stampedLabel = e.tenureLabel || outgoingTenureLabel;
        const updatedEvt: EventItem = {
          ...e,
          tenureId: stampedId,
          tenureLabel: stampedLabel,
        };
        pastEventsForArchive.push(updatedEvt);
        if (!e.tenureId || !e.tenureLabel) {
          eventsToUpdateInFirestore.push(updatedEvt);
        }
      }
    }

    // 4. Update tenures array
    const updatedTenures = tenures.map((tenure) => {
      if (tenure.id === currentlyActive?.id) {
        return {
          ...tenure,
          isCurrent: false,
          isDraft: false,
          status: "archived" as const,
          endDate: oldTenureEndDateIso,
          adminCouncil: currentCouncil.length > 0 ? currentCouncil : tenure.adminCouncil,
          hostingCommittee: currentHosting.length > 0 ? currentHosting : tenure.hostingCommittee,
          clubs: currentClubs.length > 0 ? currentClubs : tenure.clubs,
          events: pastEventsForArchive,
        };
      }
      if (tenure.id === targetTenureId) {
        const nextCouncil = Array.isArray(tenure.adminCouncil) && tenure.adminCouncil.length > 0
          ? tenure.adminCouncil
          : [];
        const nextHosting = Array.isArray(tenure.hostingCommittee) && tenure.hostingCommittee.length > 0
          ? tenure.hostingCommittee
          : [];
        const nextClubs = Array.isArray(tenure.clubs) && tenure.clubs.length > 0
          ? tenure.clubs
          : [];

        // Dedup target events
        const dedupedTargetEventsMap = new Map<string, EventItem>();
        for (const ev of [...futureOrCurrentEventsForTarget, ...(tenure.events || [])]) {
          dedupedTargetEventsMap.set(ev.id || ev.slug, {
            ...ev,
            tenureId: targetTenureId,
            tenureLabel: targetTenureLabel,
          });
        }

        return {
          ...tenure,
          isCurrent: true,
          isDraft: false,
          status: "active" as const,
          startDate: beginIso,
          previousTenureId: wasDraft && currentlyActive ? currentlyActive.id : tenure.previousTenureId,
          activatedFromDraft: wasDraft && currentlyActive ? true : tenure.activatedFromDraft,
          adminCouncil: nextCouncil,
          hostingCommittee: nextHosting,
          clubs: nextClubs,
          events: Array.from(dedupedTargetEventsMap.values()),
        };
      }
      return tenure;
    });

    const newlyActiveTenure = updatedTenures.find((t) => t.id === targetTenureId)!;

    // 5. Atomic Batch Write to Firestore
    const batch = writeBatch(db);

    // Write updated council_tenures
    batch.set(
      doc(db, "site_content", "council_tenures"),
      { payload: cleanUndefined(updatedTenures), updatedAt: serverTimestamp() },
      { merge: true }
    );

    // Write new active council_team
    if (newlyActiveTenure.adminCouncil && newlyActiveTenure.adminCouncil.length > 0) {
      batch.set(
        doc(db, "site_content", "council_team"),
        { payload: cleanUndefined(newlyActiveTenure.adminCouncil), updatedAt: serverTimestamp() },
        { merge: true }
      );
    }

    // Write new active hosting_committee
    batch.set(
      doc(db, "site_content", "hosting_committee"),
      { payload: cleanUndefined(newlyActiveTenure.hostingCommittee || []), updatedAt: serverTimestamp() },
      { merge: true }
    );

    // Write new active clubs
    if (newlyActiveTenure.clubs && newlyActiveTenure.clubs.length > 0) {
      batch.set(
        doc(db, "site_content", "clubs"),
        { payload: cleanUndefined(newlyActiveTenure.clubs), updatedAt: serverTimestamp() },
        { merge: true }
      );
    }

    // Write stamped events (up to 400 events safely within Firestore's 500 limit per batch)
    for (const evt of eventsToUpdateInFirestore.slice(0, 400)) {
      const docId = getEventDocId(evt);
      batch.set(
        doc(db, "events", docId),
        { ...cleanUndefined(evt), updatedAt: serverTimestamp() },
        { merge: true }
      );
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Tenure [${targetTenureLabel}] activated successfully across cloud state.`,
      activeTenure: newlyActiveTenure,
    });
  } catch (error: any) {
    console.error("Error in /api/admin/tenure/switch:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to switch active tenure." },
      { status: 500 }
    );
  }
}
