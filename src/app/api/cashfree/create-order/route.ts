import { NextRequest, NextResponse } from "next/server";
import { createCashfreeOrder, getServerCashfreeCredentials } from "@/lib/cashfree";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      amount,
      eventId,
      eventName,
      eventSlug,
      parentEventId,
      parentEventName,
      subEventBadge,
      tenureId,
      participantName,
      email,
      phone,
      registrationId,
      btId,
      registrationDraft,
    } = body;

    const parsedAmount = Number(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid registration amount specified." },
        { status: 400 }
      );
    }

    const { db } = await import("@/lib/firebase/config");
    const { doc, setDoc, collection, query, where, getDocs } = await import("firebase/firestore");

    // Anti-duplicate protection: prevent duplicate order creation if student already has a confirmed pass
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY && (eventId || eventSlug || eventName)) {
      try {
        const cleanEmail = (email || "").toLowerCase().trim();
        const cleanBt = (btId || "").toUpperCase().trim();
        const targetEventId = (eventId || "").trim().toLowerCase();
        const targetEventSlug = (eventSlug || "").trim().toLowerCase();
        const targetEventName = (eventName || "").trim().toLowerCase();

        const isStudentMatch = (data: any) => {
          const rEmail = (data.email || "").trim().toLowerCase();
          const rBt = (data.btId || "").trim().toUpperCase();

          if (cleanEmail && rEmail && rEmail === cleanEmail) return true;
          if (cleanBt && rBt && cleanBt !== "STUDENT" && rBt === cleanBt) return true;

          const members = Array.isArray(data.teamMembers) ? data.teamMembers : Array.isArray(data.members) ? data.members : [];
          return members.some((m: any) => {
            const mEmail = (m?.email || "").trim().toLowerCase();
            const mBt = (m?.btId || "").trim().toUpperCase();
            if (cleanEmail && mEmail && mEmail === cleanEmail) return true;
            if (cleanBt && mBt && cleanBt !== "STUDENT" && mBt === cleanBt) return true;
            return false;
          });
        };

        const isEventRecordMatch = (data: any) => {
          if (!data || data.status === "CANCELLED" || data.paymentStatus === "FAILED") return false;
          if (data.status !== "CONFIRMED" && data.paymentStatus !== "PAID") return false;

          const rId = (data.eventId || "").trim().toLowerCase();
          const rSlug = (data.eventSlug || "").trim().toLowerCase();
          const rName = (data.eventName || data.eventTitle || "").trim().toLowerCase();

          if (targetEventId && (rId === targetEventId || rSlug === targetEventId)) return true;
          if (targetEventSlug && (rSlug === targetEventSlug || rId === targetEventSlug)) return true;
          if (targetEventName && rName) {
            const stripped1 = targetEventName.replace(/[^a-z0-9]/g, "");
            const stripped2 = rName.replace(/[^a-z0-9]/g, "");
            if (stripped1 && stripped2 && (stripped1 === stripped2 || stripped1.includes(stripped2) || stripped2.includes(stripped1))) {
              return true;
            }
          }
          return false;
        };

        if (cleanEmail) {
          const qEmail = query(collection(db, "registrations"), where("email", "==", cleanEmail));
          const snap = await getDocs(qEmail);
          const existing = snap.docs.find((d) => isEventRecordMatch(d.data()));
          if (existing) {
            return NextResponse.json(
              {
                success: false,
                error: `A confirmed pass already exists for this email (${cleanEmail}) for ${eventName || "this event"}. Duplicate registrations are not allowed.`,
              },
              { status: 409 }
            );
          }
        }

        if (cleanBt && cleanBt !== "STUDENT") {
          const qBt = query(collection(db, "registrations"), where("btId", "==", cleanBt));
          const snap = await getDocs(qBt);
          const existing = snap.docs.find((d) => isEventRecordMatch(d.data()));
          if (existing) {
            return NextResponse.json(
              {
                success: false,
                error: `A confirmed pass already exists for this BT ID (${cleanBt}) for ${eventName || "this event"}. Duplicate registrations are not allowed.`,
              },
              { status: 409 }
            );
          }
        }

        // Fallback: Check if participant is part of an existing team registration for this event
        if (targetEventId) {
          const qEvent = query(collection(db, "registrations"), where("eventId", "==", targetEventId));
          const snapEvent = await getDocs(qEvent);
          const existing = snapEvent.docs.find((d) => {
            const data = d.data();
            return isEventRecordMatch(data) && isStudentMatch(data);
          });
          if (existing) {
            return NextResponse.json(
              {
                success: false,
                error: `A confirmed pass already exists for you (or as part of a registered team) for ${eventName || "this event"}. Duplicate registrations are not allowed.`,
              },
              { status: 409 }
            );
          }
        }
      } catch (dupErr) {
        console.warn("Notice: duplicate check warning in create-order:", dupErr);
      }
    }

    const creds = await getServerCashfreeCredentials();

    // Unique order ID (Alphanumeric, max 45 chars for Cashfree standard)
    const cleanRegPrefix = (registrationId || "REG")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-12);
    const orderId = `SRC_${cleanRegPrefix}_${Date.now()}`;

    // Clean customer ID
    const cleanCustomerId = (btId || email || "student")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 32);

    const origin = req.nextUrl?.origin || process.env.NEXT_PUBLIC_SITE_URL || "https://www.srcjdcoem.in";
    const siteUrl = origin.replace("://srcjdcoem.in", "://www.srcjdcoem.in");
    const targetReturnUrl = eventSlug
      ? `${siteUrl}/events/${eventSlug}/register?order_id={order_id}`
      : `${siteUrl}/events?order_id={order_id}`;

    const cashfreeOrder = await createCashfreeOrder({
      orderId,
      orderAmount: parsedAmount,
      orderCurrency: "INR",
      customerDetails: {
        customerId: cleanCustomerId || `cust_${Date.now()}`,
        customerName: participantName || "Student Delegate",
        customerEmail: email || "student@jdcoem.ac.in",
        customerPhone: phone || "9999999999",
      },
      orderMeta: {
        returnUrl: targetReturnUrl,
        notifyUrl: `${siteUrl}/api/cashfree/webhook`,
      },
      orderNote: `SRC JDCOEM: ${eventName || "Event Entry Pass"}`,
      orderTags: {
        eventId: (eventId || "").slice(0, 20),
        registrationId: (registrationId || "").slice(0, 30),
      },
    }, creds);

    // Persist active checkout session ONLY. Invariant: DO NOT pre-create unconfirmed pass in registrations
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      try {
        const nowIso = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        await setDoc(
          doc(db, "active_checkout_sessions", orderId),
          {
            orderId,
            cfOrderId: String(cashfreeOrder.cf_order_id),
            gateway: "cashfree",
            status: "WAITING",
            amount: parsedAmount,
            eventId: eventId || "",
            eventName: eventName || "",
            eventSlug: eventSlug || "",
            parentEventId: parentEventId || null,
            parentEventName: parentEventName || null,
            subEventBadge: subEventBadge || null,
            tenureId: tenureId || null,
            registrationId: registrationId || "",
            registrationData: registrationDraft || null,
            participantName: participantName || "",
            email: email || "",
            phone: phone || "",
            btId: btId || "",
            createdAt: nowIso,
            expiresAt,
          },
          { merge: true }
        );
      } catch (fsErr) {
        console.warn("Notice: could not save active_checkout_sessions in Firestore:", fsErr);
      }
    }

    return NextResponse.json({
      success: true,
      orderId: cashfreeOrder.order_id,
      cfOrderId: cashfreeOrder.cf_order_id,
      paymentSessionId: cashfreeOrder.payment_session_id,
      amount: cashfreeOrder.order_amount,
      orderStatus: cashfreeOrder.order_status,
      environment: creds.environment,
      appId: creds.appId,
    });
  } catch (error: any) {
    console.error("Cashfree order creation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to initialize Cashfree payment order.",
      },
      { status: 500 }
    );
  }
}
