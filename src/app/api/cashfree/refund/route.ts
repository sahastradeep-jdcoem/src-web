import { NextRequest, NextResponse } from "next/server";
import { createCashfreeRefund, getServerCashfreeCredentials } from "@/lib/cashfree";
import { verifyAdminRequest } from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  try {
    // Enforce Administrator Authentication & Role Authorization
    const authResult = await verifyAdminRequest(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Unauthorized: Administrator privileges required." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { orderId, refundAmount, refundId, note } = body;

    if (!orderId || !refundAmount || isNaN(Number(refundAmount))) {
      return NextResponse.json(
        { success: false, error: "Order ID and valid refund amount are required." },
        { status: 400 }
      );
    }

    const creds = await getServerCashfreeCredentials();
    const generatedRefundId = refundId || `ref_${Date.now()}`;

    const refundRes = await createCashfreeRefund(
      orderId,
      Number(refundAmount),
      generatedRefundId,
      note || `Refund initiated by ${authResult.email || "SRC JDCOEM Admin"}`,
      creds
    );

    // Record audit trail of refund action
    try {
      const { db } = await import("@/lib/firebase/config");
      const { doc, setDoc } = await import("firebase/firestore");
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        const logId = `AUDIT-REFUND-${Date.now()}`;
        await setDoc(doc(db, "upi_webhook_logs", logId), {
          id: logId,
          receivedAt: new Date().toISOString(),
          gateway: "cashfree",
          eventType: "ADMIN_REFUND_EXECUTED",
          orderId,
          refundId: generatedRefundId,
          amount: Number(refundAmount),
          executedBy: authResult.email,
          userRole: authResult.role,
        });
      }
    } catch (auditErr) {
      console.warn("Notice: refund audit log warning:", auditErr);
    }

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
