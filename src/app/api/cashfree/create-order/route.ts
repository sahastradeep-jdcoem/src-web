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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.srcjdcoem.in";
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

    // Persist active checkout session and draft registration to Firestore
    try {
      const { db } = await import("@/lib/firebase/config");
      const { doc, setDoc } = await import("firebase/firestore");

      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
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

        if (registrationDraft && registrationId) {
          await setDoc(
            doc(db, "registrations", registrationId),
            {
              ...registrationDraft,
              id: registrationId,
              orderId,
              status: "PENDING",
              paymentStatus: "PENDING",
              amountPaid: parsedAmount,
              createdAt: nowIso,
            },
            { merge: true }
          );
        }
      }
    } catch (fsErr) {
      console.warn("Notice: could not pre-create session/draft in Firestore:", fsErr);
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
