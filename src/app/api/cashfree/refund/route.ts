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
    const { orderId, registrationId, refundAmount, refundId, note } = body;

    if (!orderId || !refundAmount || isNaN(Number(refundAmount))) {
      return NextResponse.json(
        { success: false, error: "Order ID and valid refund amount are required." },
        { status: 400 }
      );
    }

    // 1. Guard against duplicate refunds by checking registration state
    try {
      const { db } = await import("@/lib/firebase/config");
      const { doc, getDoc, collection, query, where, getDocs } = await import("firebase/firestore");
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        let existingDocData: any = null;

        if (registrationId) {
          const directSnap = await getDoc(doc(db, "registrations", registrationId));
          if (directSnap.exists()) existingDocData = directSnap.data();
        }

        if (!existingDocData && orderId) {
          const q = query(collection(db, "registrations"), where("orderId", "==", orderId));
          const snap = await getDocs(q);
          if (!snap.empty) existingDocData = snap.docs[0].data();
        }

        if (existingDocData) {
          if (existingDocData.refundStatus === "PROCESSED" || existingDocData.paymentStatus === "REFUNDED") {
            return NextResponse.json(
              {
                success: false,
                error: `This transaction has already been refunded (Refund ID: ${existingDocData.refundId || "Recorded"}).`,
              },
              { status: 400 }
            );
          }
        }
      }
    } catch (checkErr) {
      console.warn("Notice: pre-refund check warning:", checkErr);
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
          registrationId: registrationId || null,
          refundId: refundRes.refund_id || generatedRefundId,
          cfRefundId: refundRes.cf_refund_id || null,
          refundStatus: refundRes.refund_status || "PROCESSED",
          refundArn: refundRes.refund_arn || null,
          amount: Number(refundAmount),
          executedBy: authResult.email,
          userRole: authResult.role,
          note: note || "Refund executed via SRC Secretariat",
        });
      }
    } catch (auditErr) {
      console.warn("Notice: refund audit log warning:", auditErr);
    }

    return NextResponse.json({
      success: true,
      refundId: refundRes.refund_id || generatedRefundId,
      cfRefundId: refundRes.cf_refund_id,
      status: refundRes.refund_status || "PROCESSED",
      amount: refundRes.refund_amount || Number(refundAmount),
      refundArn: refundRes.refund_arn || null,
      refundMode: refundRes.refund_mode || null,
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
