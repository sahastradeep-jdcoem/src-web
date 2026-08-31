import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      isMockMode
    } = body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // In mock mode or if secret is not set yet
    if (isMockMode || !keySecret || keySecret.includes("placeholder")) {
      return NextResponse.json({
        verified: true,
        paymentId: razorpay_payment_id || `pay_mock_${Date.now()}`,
        orderId: razorpay_order_id || `order_mock_${Date.now()}`,
        message: "Payment verified in test sandbox mode.",
      });
    }

    // Verify cryptographic signature from Razorpay
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { verified: false, error: "Missing signature verification parameters." },
        { status: 400 }
      );
    }

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(payload)
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return NextResponse.json(
        { verified: false, error: "Cryptographic signature validation failed. Payment may have been tampered." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      verified: true,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      message: "Payment successfully verified by Razorpay security gateway.",
    });

  } catch (error: any) {
    console.error("Razorpay verification failed:", error);
    return NextResponse.json(
      { verified: false, error: error?.message || "Internal payment verification error." },
      { status: 500 }
    );
  }
}
