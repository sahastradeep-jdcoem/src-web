import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

const WEBHOOK_MAX_SKEW_SECONDS = 5 * 60;

function isValidSignature(req: NextRequest, rawBody: string): boolean {
  const timestamp = req.headers.get("x-webhook-timestamp");
  const signature = req.headers.get("x-webhook-signature");
  const secret = process.env.CASHFREE_SECRET_KEY;

  if (!timestamp || !signature || !secret || !/^\d+$/.test(timestamp)) return false;

  const timestampNumber = Number(timestamp);
  const timestampSeconds = timestampNumber > 1e12
    ? Math.floor(timestampNumber / 1000)
    : timestampNumber;
  if (!Number.isSafeInteger(timestampSeconds) ||
      Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > WEBHOOK_MAX_SKEW_SECONDS) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}${rawBody}`, "utf8")
    .digest("base64");
  const actualBuffer = Buffer.from(signature, "base64");
  const expectedBuffer = Buffer.from(expected, "base64");
  return actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer);
}

/**
 * Health check & reachability ping for Cashfree dashboard test
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "OK",
      service: "Cashfree Webhook Engine",
      version: "2023-08-01",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // 1. Handle Cashfree Dashboard Verification / Test Ping
    const hasSignature = Boolean(req.headers.get("x-webhook-signature"));
    if (!hasSignature || rawBody.trim().length === 0) {
      console.log("[Cashfree Webhook] Verified Dashboard Ping / Test Probe");
      return NextResponse.json(
        {
          status: "SUCCESS",
          message: "Cashfree webhook probe acknowledged successfully",
        },
        { status: 200 }
      );
    }

    // 2. Validate HMAC SHA256 Signature for production event webhooks
    if (!isValidSignature(req, rawBody)) {
      console.warn("[Cashfree Webhook] Signature verification failed");
      return NextResponse.json(
        { status: "ERROR", message: "Invalid or missing webhook signature" },
        { status: 401 }
      );
    }

    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ status: "IGNORED", message: "Non-JSON body" }, { status: 400 });
    }

    const eventType = body?.type;
    const paymentData = body?.data?.payment;
    const orderData = body?.data?.order;
    const refundData = body?.data?.refund;

    console.log(`[Cashfree Webhook] Received ${eventType} for order: ${orderData?.order_id || refundData?.order_id}`);

    // A. Payment Success
    if (eventType === "PAYMENT_SUCCESS_WEBHOOK" || paymentData?.payment_status === "SUCCESS") {
      const orderId = orderData?.order_id;
      const utr = paymentData?.bank_reference || paymentData?.cf_payment_id;
      const amount = paymentData?.payment_amount || orderData?.order_amount;
      const registrationId = orderData?.order_tags?.registrationId;

      console.log(`[Cashfree Webhook] Verified Payment SUCCESS: Order=${orderId}, UTR=${utr}, Reg=${registrationId}, Amount=₹${amount}`);

      let confirmationResult: any = { success: false };
      if (orderId) {
        const { confirmCashfreeOrderRegistration } = await import("@/lib/cashfree");
        confirmationResult = await confirmCashfreeOrderRegistration(orderId);
      }

      // Record audit diagnostic log
      try {
        const { db } = await import("@/lib/firebase/config");
        const { doc, setDoc } = await import("firebase/firestore");
        if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
          const logId = `CF-${Date.now()}`;
          await setDoc(doc(db, "upi_webhook_logs", logId), {
            id: logId,
            receivedAt: new Date().toISOString(),
            gateway: "cashfree",
            eventType,
            orderId: orderId || null,
            extractedUtr: utr ? String(utr) : null,
            extractedAmount: amount ? Number(amount) : null,
            matchedRegistrationId: confirmationResult?.registrationId || registrationId || null,
            matchedStudentName: confirmationResult?.registration?.participantName || null,
          });
        }
      } catch (logErr) {
        console.warn("Notice: webhook diagnostic logging skipped:", logErr);
      }

      return NextResponse.json({
        status: "SUCCESS",
        orderId,
        utr,
        registrationId: confirmationResult?.registrationId || registrationId,
        message: "Payment successfully confirmed and pass issued in Firestore",
      });
    }

    // B. Payment Failed
    if (eventType === "PAYMENT_FAILED_WEBHOOK" || paymentData?.payment_status === "FAILED") {
      const orderId = orderData?.order_id;
      const failureReason = paymentData?.payment_message || "Payment declined or failed";
      console.warn(`[Cashfree Webhook] Payment FAILED: Order=${orderId}, Reason=${failureReason}`);

      return NextResponse.json({
        status: "FAILED",
        orderId,
        reason: failureReason,
        message: "Payment failure acknowledged",
      });
    }

    // C. User Dropped Payment Session
    if (eventType === "PAYMENT_USER_DROPPED_WEBHOOK" || paymentData?.payment_status === "USER_DROPPED") {
      const orderId = orderData?.order_id;
      console.log(`[Cashfree Webhook] User DROPPED payment session: Order=${orderId}`);

      return NextResponse.json({
        status: "USER_DROPPED",
        orderId,
        message: "User dropped session acknowledged",
      });
    }

    // D. Refund Status / Success
    if (eventType === "REFUND_STATUS_WEBHOOK" || eventType === "REFUND_SUCCESS_WEBHOOK") {
      const refundId = refundData?.refund_id || refundData?.cf_refund_id;
      const orderId = refundData?.order_id || orderData?.order_id;
      const refundStatus = refundData?.refund_status || "PROCESSED";
      const refundAmount = refundData?.refund_amount;
      console.log(`[Cashfree Webhook] Refund ${refundStatus}: RefundId=${refundId}, Order=${orderId}`);

      if (orderId && refundStatus === "SUCCESS") {
        try {
          const { db } = await import("@/lib/firebase/config");
          const { collection, query, where, getDocs, updateDoc } = await import("firebase/firestore");
          if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
            const q = query(collection(db, "registrations"), where("orderId", "==", orderId));
            const snap = await getDocs(q);
            const nowIso = new Date().toISOString();
            for (const d of snap.docs) {
              await updateDoc(d.ref, {
                paymentStatus: "REFUNDED",
                status: "CANCELLED",
                refundStatus: "PROCESSED",
                refundId,
                refundAmount: Number(refundAmount || 0),
                refundedAt: nowIso,
              });
            }
          }
        } catch (rfErr) {
          console.warn("Notice: refund status sync warning:", rfErr);
        }
      }

      return NextResponse.json({
        status: "REFUND_PROCESSED",
        refundId,
        orderId,
        refundStatus,
        message: "Refund status acknowledged",
      });
    }

    // E. Refund Failed
    if (eventType === "REFUND_FAILED_WEBHOOK") {
      const refundId = refundData?.refund_id;
      const orderId = refundData?.order_id || orderData?.order_id;
      console.warn(`[Cashfree Webhook] Refund FAILED: RefundId=${refundId}, Order=${orderId}`);

      return NextResponse.json({
        status: "REFUND_FAILED",
        refundId,
        orderId,
        message: "Refund failure acknowledged",
      });
    }

    return NextResponse.json({ status: "ACKNOWLEDGED", eventType });
  } catch (error: any) {
    console.error("[Cashfree Webhook] Error:", error);
    return NextResponse.json(
      { status: "ERROR", message: error.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}
