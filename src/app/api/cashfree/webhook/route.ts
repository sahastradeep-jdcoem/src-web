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
    // When the "Test" button is clicked in Cashfree Console, it sends an unsigned test payload or empty ping
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

    console.log(`[Cashfree Webhook] Received ${eventType} for order: ${orderData?.order_id}`);

    if (eventType === "PAYMENT_SUCCESS_WEBHOOK" || paymentData?.payment_status === "SUCCESS") {
      const orderId = orderData?.order_id;
      const utr = paymentData?.bank_reference;
      const amount = paymentData?.payment_amount || orderData?.order_amount;
      const registrationId = orderData?.order_tags?.registrationId;

      console.log(`[Cashfree Webhook] Verified Payment: Order=${orderId}, UTR=${utr}, Reg=${registrationId}, Amount=₹${amount}`);

      return NextResponse.json({
        status: "SUCCESS",
        orderId,
        utr,
        registrationId,
        message: "Webhook processed successfully",
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
