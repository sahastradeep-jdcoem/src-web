import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, amount, registrationId, reason } = body;

    if (!paymentId) {
      return NextResponse.json(
        { error: "Payment ID is required to process refund." },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Convert amount to paise if specified (e.g., ₹150 -> 15000 paise)
    const amountInPaise = amount && Number(amount) > 0 ? Math.round(Number(amount) * 100) : undefined;

    // If real Razorpay keys are configured, issue live refund via Razorpay API
    if (keyId && keySecret && !keyId.includes("placeholder") && !keySecret.includes("placeholder")) {
      const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      const refundOptions: any = {
        speed: "normal",
        notes: {
          registrationId: registrationId || "N/A",
          reason: reason || "Event cancelled by SRC Administration",
          refundInitiatedBy: "SRC Council Admin Console",
        },
      };

      if (amountInPaise) {
        refundOptions.amount = amountInPaise;
      }

      const refund = await (razorpay.payments as any).refund(paymentId, refundOptions);

      return NextResponse.json({
        success: true,
        refundId: refund.id,
        status: refund.status === "processed" ? "PROCESSED" : "INITIATED",
        amount: (refund.amount || amountInPaise || 0) / 100,
        currency: refund.currency || "INR",
        isMockMode: false,
        message: "Refund successfully issued via Razorpay gateway.",
      });
    }

    // Sandbox / Test fallback if running without live credentials
    const mockRefundId = `rfnd_mock_${Date.now().toString().slice(-6)}_${Math.floor(100 + Math.random() * 900)}`;
    const refundedRupees = amount ? Number(amount) : 0;

    return NextResponse.json({
      success: true,
      refundId: mockRefundId,
      status: "PROCESSED",
      amount: refundedRupees,
      currency: "INR",
      isMockMode: true,
      message: "Refund processed in test sandbox mode.",
    });

  } catch (error: any) {
    console.error("Razorpay refund processing error:", error);
    const errorMessage = error?.error?.description || error?.message || "Failed to process refund with Razorpay.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
