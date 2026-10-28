import { NextRequest, NextResponse } from "next/server";
import { createInstamojoPaymentRequest, getServerInstamojoCredentials } from "@/lib/instamojo";
import { getEventFromFirestore } from "@/lib/firebase/firestore";

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

    const origin = req.nextUrl?.origin || process.env.NEXT_PUBLIC_SITE_URL || "https://www.srcjdcoem.in";
    const siteUrl = origin.replace("://srcjdcoem.in", "://www.srcjdcoem.in");

    // 0. Instant Admin Connection Health Ping Support
    const isTestPing = registrationId === "TEST-PING" || Boolean(body.isTestPing);
    if (isTestPing) {
      const creds = await getServerInstamojoCredentials();
      const testPr = await createInstamojoPaymentRequest(
        {
          amount: 10,
          purpose: "SRC Gateway Verification",
          buyerName: "SRC Gateway Verification",
          email: email || "srcjdcoem@gmail.com",
          phone: phone || "9529441964",
          redirectUrl: `${siteUrl}/api/instamojo/callback?test=1`,
          sendEmail: false,
          sendSms: false,
        },
        creds
      );

      return NextResponse.json({
        success: true,
        isTestPing: true,
        orderId: testPr.id,
        paymentRequestId: testPr.id,
        longUrl: testPr.longurl,
        shortUrl: testPr.shorturl,
        environment: creds.environment,
      });
    }

    // 1. Authoritative Event Lookup & Server-Side Fee Verification
    const lookupTarget = eventId || eventSlug;
    let authoritativeEvent = lookupTarget ? await getEventFromFirestore(lookupTarget) : null;
    if (!authoritativeEvent && eventSlug && eventId && eventSlug !== eventId) {
      authoritativeEvent = await getEventFromFirestore(eventSlug);
    }

    if (!authoritativeEvent) {
      return NextResponse.json(
        { success: false, error: "The requested event could not be found or is inactive." },
        { status: 404 }
      );
    }

    if (authoritativeEvent.isCancelled || authoritativeEvent.status === "Cancelled") {
      return NextResponse.json(
        { success: false, error: "This event has been cancelled. Registrations are closed." },
        { status: 400 }
      );
    }

    if (authoritativeEvent.registrationDeadline) {
      const deadlineMs = new Date(authoritativeEvent.registrationDeadline).getTime();
      if (!isNaN(deadlineMs) && deadlineMs < Date.now()) {
        return NextResponse.json(
          { success: false, error: "Registrations for this event have closed." },
          { status: 400 }
        );
      }
    }

    const isPaid = Boolean(
      (authoritativeEvent.feeAmount && authoritativeEvent.feeAmount > 0) ||
      (authoritativeEvent.teamFeeAmount && authoritativeEvent.teamFeeAmount > 0)
    );

    if (!isPaid) {
      return NextResponse.json(
        { success: false, error: "This is a free event. Payment order creation is not permitted." },
        { status: 400 }
      );
    }

    // Determine authoritative payable fee
    let expectedFee = 0;
    const isTeam =
      registrationDraft?.teamType === "Team" ||
      (Array.isArray(registrationDraft?.teamMembers) && registrationDraft.teamMembers.length > 1);

    if (isTeam) {
      if (authoritativeEvent.feePricingModel === "per_team" && authoritativeEvent.teamFeeAmount) {
        expectedFee = Number(authoritativeEvent.teamFeeAmount);
      } else {
        const memberCount = Math.max(1, registrationDraft?.teamMembers?.length || 1);
        const perMember = typeof authoritativeEvent.feeAmount === "number" ? authoritativeEvent.feeAmount : 100;
        expectedFee = perMember * memberCount;
      }
    } else {
      expectedFee = typeof authoritativeEvent.feeAmount === "number" ? authoritativeEvent.feeAmount : 100;
    }

    if (expectedFee <= 0) expectedFee = parsedAmount;

    // Instamojo hard platform policy requires minimum transaction of ₹9.00
    if (expectedFee < 9) {
      return NextResponse.json(
        {
          success: false,
          error: "Instamojo requires a minimum payment amount of ₹9.00 per transaction. Please set the event fee to at least ₹9 or ₹10 (or use Cashfree for ₹1 tests).",
        },
        { status: 400 }
      );
    }

    // 2. Duplicate Registration Prevention
    const { db } = await import("@/lib/firebase/config");
    const { doc, setDoc } = await import("firebase/firestore");

    const creds = await getServerInstamojoCredentials();
    const targetSlug = authoritativeEvent.slug || eventSlug || "event";
    const returnUrl = `${siteUrl}/api/instamojo/callback?event_slug=${encodeURIComponent(targetSlug)}`;

    // Create payment request on Instamojo
    const cleanEventTitle = (eventName || authoritativeEvent.name || "Event Pass").slice(0, 24);
    const pr = await createInstamojoPaymentRequest(
      {
        amount: expectedFee,
        purpose: `SRC: ${cleanEventTitle}`,
        buyerName: participantName || "Student Delegate",
        email: email || "student@jdcoem.ac.in",
        phone: phone || "9999999999",
        redirectUrl: returnUrl,
        webhookUrl: `${siteUrl}/api/instamojo/webhook`,
        sendEmail: false,
        sendSms: false,
      },
      creds
    );

    // Save active checkout session
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      try {
        const nowIso = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        await setDoc(
          doc(db, "active_checkout_sessions", pr.id),
          {
            orderId: pr.id,
            gateway: "instamojo",
            status: "WAITING",
            amount: expectedFee,
            expectedAmount: expectedFee,
            authoritativeFee: expectedFee,
            feePricingModel: authoritativeEvent.feePricingModel || "per_person",
            eventId: eventId || authoritativeEvent.id || "",
            eventName: eventName || authoritativeEvent.name || "",
            eventSlug: authoritativeEvent.slug || eventSlug || "",
            parentEventId: parentEventId || authoritativeEvent.parentEventId || null,
            parentEventName: parentEventName || authoritativeEvent.parentEventName || null,
            subEventBadge: subEventBadge || authoritativeEvent.subEventBadge || null,
            tenureId: tenureId || authoritativeEvent.tenureId || "",
            participantName: participantName || "",
            email: email || "",
            phone: phone || "",
            btId: btId || "",
            registrationId: registrationId || `SRC-${targetSlug.slice(0, 3).toUpperCase()}-26-${pr.id.slice(0, 6)}`,
            registrationData: registrationDraft || null,
            createdAt: nowIso,
            expiresAt,
            longUrl: pr.longurl,
            shortUrl: pr.shorturl,
          },
          { merge: true }
        );
      } catch (sessionErr) {
        console.warn("Notice: could not persist active_checkout_session:", sessionErr);
      }
    }

    return NextResponse.json({
      success: true,
      orderId: pr.id,
      paymentRequestId: pr.id,
      longUrl: pr.longurl,
      shortUrl: pr.shorturl,
      amount: expectedFee,
    });
  } catch (error: any) {
    console.error("Instamojo create-order error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to initialize Instamojo payment request.",
      },
      { status: 500 }
    );
  }
}
