import { NextRequest, NextResponse } from "next/server";
import { createCashfreeRefund, getServerCashfreeCredentials } from "@/lib/cashfree";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, refundAmount, refundId, note } = body;

    if (!orderId || !refundAmount || isNaN(Number(refundAmount))) {
      return NextResponse.json(
        { success: false, error: "Order ID and valid refund amount are required." },
        { status: 400 }
      );
    }

    const creds = getServerCashfreeCredentials();
    const generatedRefundId = refundId || `ref_${Date.now()}`;

    const refundRes = await createCashfreeRefund(
      orderId,
      Number(refundAmount),
      generatedRefundId,
      note || "Refund initiated by SRC JDCOEM",
      creds
    );

    return NextResponse.json({
      success: true,
      refund: refundRes,
    });
  } catch (error: any) {
    console.error("Cashfree refund error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process Cashfree refund.",
      },
      { status: 500 }
    );
  }
}
