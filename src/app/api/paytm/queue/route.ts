import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from "firebase/firestore";

const MAX_CONCURRENT_CHECKOUTS = 3;
const QUEUE_HEARTBEAT_STALE_MS = 25 * 1000;
const ADMISSION_HOLD_MS = 30 * 1000;
const DEFAULT_SESSION_TTL_MS = 4 * 60 * 1000;

interface QueueTicketRecord {
  ticketId: string;
  eventId: string;
  email: string;
  btId: string;
  status: "QUEUED" | "ADMITTED" | "RELEASED" | "EXPIRED";
  createdAt: string;
  lastHeartbeatAt: string;
  admittedAt?: string;
}

function getExpiryMs(sData: Record<string, any>): number {
  if (sData.expiresAt) {
    const parsed = new Date(sData.expiresAt).getTime();
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  if (sData.createdAt) {
    const parsed = new Date(sData.createdAt).getTime();
    if (!Number.isNaN(parsed) && parsed > 0) return parsed + DEFAULT_SESSION_TTL_MS;
  }
  return 0;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action = "enter",
      ticketId: rawTicketId,
      orderId: rawOrderId,
      eventId = "",
      email = "",
      btId = "",
    } = body || {};

    if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      return NextResponse.json({
        success: true,
        status: "ADMITTED",
        ticketId: rawTicketId || `SRC-Q-LOCAL-${Date.now()}`,
        activeSlotsUsed: 0,
        maxSlots: MAX_CONCURRENT_CHECKOUTS,
        position: 0,
        queueLength: 0,
        estimatedWaitSeconds: 0,
      });
    }

    const cleanEventId = String(eventId || "").trim().toLowerCase();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanBt = String(btId || "").trim().toUpperCase();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // Action: leave / release (immediately free slot or leave queue)
    if (action === "leave" || action === "release") {
      const promises: Promise<any>[] = [];

      if (rawTicketId && typeof rawTicketId === "string") {
        const tRef = doc(db, "checkout_queue", rawTicketId);
        promises.push(
          getDoc(tRef).then((snap) => {
            if (snap.exists()) {
              const cur = snap.data()?.status;
              if (cur === "QUEUED" || cur === "ADMITTED") {
                return setDoc(
                  tRef,
                  {
                    status: "RELEASED",
                    releasedAt: nowIso,
                    lastHeartbeatAt: nowIso,
                  },
                  { merge: true }
                );
              }
            }
          }).catch(() => {})
        );
      }

      if (rawOrderId && typeof rawOrderId === "string") {
        const sRef = doc(db, "active_checkout_sessions", rawOrderId);
        promises.push(
          getDoc(sRef).then((snap) => {
            if (snap.exists() && snap.data()?.status === "WAITING") {
              return setDoc(
                sRef,
                {
                  status: "EXPIRED",
                  expiredAt: nowIso,
                  expiredReason: "USER_RELEASED_SLOT",
                },
                { merge: true }
              );
            }
          }).catch(() => {})
        );
      }

      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }

      return NextResponse.json({
        success: true,
        status: "RELEASED",
      });
    }

    // 1. Inspect active WAITING checkout sessions and evict expired timers immediately
    const waitingSnap = await getDocs(
      query(
        collection(db, "active_checkout_sessions"),
        where("status", "==", "WAITING"),
        limit(150)
      )
    );

    const cleanupPromises: Promise<any>[] = [];
    const activeOtherSessions: Array<{ orderId: string; expiresAtMs: number }> = [];

    for (const d of waitingSnap.docs) {
      const sData = d.data();
      const expMs = getExpiryMs(sData);
      if (expMs <= nowMs) {
        cleanupPromises.push(
          setDoc(
            d.ref,
            {
              status: "EXPIRED",
              expiredAt: nowIso,
              expiredReason: "TTL_EXPIRED",
            },
            { merge: true }
          ).catch(() => {})
        );
        continue;
      }

      const sEmail = String(sData.email || "").trim().toLowerCase();
      const sBt = String(sData.btId || "").trim().toUpperCase();
      const sEventId = String(sData.eventId || "").trim().toLowerCase();
      const sameStudent =
        (cleanEmail && sEmail === cleanEmail) ||
        (cleanBt && cleanBt !== "STUDENT" && sBt === cleanBt);
      const sameEvent = !cleanEventId || !sEventId || sEventId === cleanEventId;

      if (!(sameStudent && sameEvent)) {
        activeOtherSessions.push({ orderId: d.id, expiresAtMs: expMs });
      }
    }

    // 2. Inspect checkout_queue tickets (QUEUED and ADMITTED) and evict stale heartbeats
    const queueSnap = await getDocs(
      query(
        collection(db, "checkout_queue"),
        where("status", "in", ["QUEUED", "ADMITTED"]),
        limit(200)
      )
    );

    const ticketId =
      rawTicketId && typeof rawTicketId === "string" && rawTicketId.trim()
        ? rawTicketId.trim()
        : `SRC-Q-${nowMs}-${Math.floor(100 + Math.random() * 900)}`;

    const aliveQueued: QueueTicketRecord[] = [];
    let activeOtherAdmittedCount = 0;
    let existingSelfTicket: QueueTicketRecord | null = null;

    for (const qDoc of queueSnap.docs) {
      const qData = qDoc.data() as QueueTicketRecord;
      const hbMs = qData.lastHeartbeatAt ? new Date(qData.lastHeartbeatAt).getTime() : 0;
      const admMs = qData.admittedAt ? new Date(qData.admittedAt).getTime() : 0;

      const isHeartbeatStale = !hbMs || nowMs - hbMs > QUEUE_HEARTBEAT_STALE_MS;
      const isAdmissionExpired =
        qData.status === "ADMITTED" && (!admMs || nowMs - admMs > ADMISSION_HOLD_MS);

      if (qDoc.id !== ticketId && (isHeartbeatStale || isAdmissionExpired)) {
        cleanupPromises.push(
          setDoc(
            qDoc.ref,
            { status: "EXPIRED", expiredAt: nowIso },
            { merge: true }
          ).catch(() => {})
        );
        continue;
      }

      const qEmail = String(qData.email || "").trim().toLowerCase();
      const qBt = String(qData.btId || "").trim().toUpperCase();
      const qEventId = String(qData.eventId || "").trim().toLowerCase();
      const sameStudent =
        (cleanEmail && qEmail === cleanEmail) ||
        (cleanBt && cleanBt !== "STUDENT" && qBt === cleanBt);
      const sameEvent = !cleanEventId || !qEventId || qEventId === cleanEventId;

      if (qDoc.id === ticketId) {
        existingSelfTicket = { ...qData, ticketId: qDoc.id };
        continue;
      }

      // Expire older duplicate tickets opened by the exact same student for the same event
      if (sameStudent && sameEvent) {
        cleanupPromises.push(
          setDoc(
            qDoc.ref,
            { status: "EXPIRED", expiredAt: nowIso },
            { merge: true }
          ).catch(() => {})
        );
        continue;
      }

      if (qData.status === "ADMITTED") {
        activeOtherAdmittedCount++;
      } else if (qData.status === "QUEUED") {
        aliveQueued.push({ ...qData, ticketId: qDoc.id });
      }
    }

    if (cleanupPromises.length > 0) {
      await Promise.allSettled(cleanupPromises);
    }

    const totalSlotsUsed = activeOtherSessions.length + activeOtherAdmittedCount;
    const availableSlots = Math.max(0, MAX_CONCURRENT_CHECKOUTS - totalSlotsUsed);

    // Preserve original createdAt if this ticket already exists so FIFO order cannot be reset
    const effectiveCreatedAt = existingSelfTicket?.createdAt || nowIso;
    const selfRecord: QueueTicketRecord = {
      ticketId,
      eventId: String(eventId || ""),
      email: String(email || ""),
      btId: String(btId || ""),
      status: existingSelfTicket?.status || "QUEUED",
      createdAt: effectiveCreatedAt,
      lastHeartbeatAt: nowIso,
      admittedAt: existingSelfTicket?.admittedAt,
    };

    // If this ticket was already ADMITTED and still has available capacity (or valid hold), keep ADMITTED
    if (
      existingSelfTicket?.status === "ADMITTED" &&
      totalSlotsUsed < MAX_CONCURRENT_CHECKOUTS
    ) {
      await setDoc(
        doc(db, "checkout_queue", ticketId),
        {
          ...selfRecord,
          status: "ADMITTED",
          admittedAt: existingSelfTicket.admittedAt || nowIso,
          lastHeartbeatAt: nowIso,
        },
        { merge: true }
      );
      return NextResponse.json({
        success: true,
        status: "ADMITTED",
        ticketId,
        activeSlotsUsed: totalSlotsUsed,
        maxSlots: MAX_CONCURRENT_CHECKOUTS,
        position: 0,
        queueLength: aliveQueued.length,
        estimatedWaitSeconds: 0,
      });
    }

    // Build strict FIFO ordering across all live QUEUED tickets + this ticket
    const allQueued = [...aliveQueued, selfRecord].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime() || 0;
      const tb = new Date(b.createdAt).getTime() || 0;
      if (ta !== tb) return ta - tb;
      return a.ticketId.localeCompare(b.ticketId);
    });

    const fifoIndex = allQueued.findIndex((t) => t.ticketId === ticketId);

    // Admit ONLY if there is free capacity AND our FIFO index falls within availableSlots
    if (availableSlots > 0 && fifoIndex >= 0 && fifoIndex < availableSlots) {
      await setDoc(
        doc(db, "checkout_queue", ticketId),
        {
          ...selfRecord,
          status: "ADMITTED",
          admittedAt: nowIso,
          lastHeartbeatAt: nowIso,
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        status: "ADMITTED",
        ticketId,
        activeSlotsUsed: totalSlotsUsed,
        maxSlots: MAX_CONCURRENT_CHECKOUTS,
        position: 0,
        queueLength: Math.max(0, allQueued.length - 1),
        estimatedWaitSeconds: 0,
      });
    }

    // Stay in FIFO queue
    await setDoc(
      doc(db, "checkout_queue", ticketId),
      {
        ...selfRecord,
        status: "QUEUED",
        lastHeartbeatAt: nowIso,
      },
      { merge: true }
    );

    const position = Math.max(1, fifoIndex + 1);
    const soonestExpiryMs =
      activeOtherSessions.length > 0
        ? Math.min(...activeOtherSessions.map((s) => s.expiresAtMs))
        : nowMs + 60 * 1000;
    const minWaitSecs = Math.max(10, Math.ceil((soonestExpiryMs - nowMs) / 1000));
    const estimatedWaitSeconds =
      position <= MAX_CONCURRENT_CHECKOUTS
        ? Math.min(240, minWaitSecs)
        : Math.min(600, minWaitSecs + (position - 1) * 45);

    return NextResponse.json({
      success: true,
      status: "QUEUED",
      ticketId,
      position,
      queueLength: allQueued.length,
      activeSlotsUsed: totalSlotsUsed,
      maxSlots: MAX_CONCURRENT_CHECKOUTS,
      estimatedWaitSeconds,
    });
  } catch (error: any) {
    console.error("Paytm checkout queue error:", error);
    return NextResponse.json(
      { error: error?.message || "Checkout queue unavailable." },
      { status: 500 }
    );
  }
}
