import { NextRequest, NextResponse } from "next/server";
import { getCashfreeOrderRefunds, getServerCashfreeCredentials } from "@/lib/cashfree";
import { verifyAdminRequest } from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAdminRequest(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Unauthorized: Administrator privileges required." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { orderId, registrationId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required to fetch refund status." },
        { status: 400 }
      );
    }

    const creds = await getServerCashfreeCredentials();
    const refunds = await getCashfreeOrderRefunds(orderId, creds);

    if (refunds.length === 0) {
      return NextResponse.json({
        success: true,
        hasRefund: false,
        message: "No refund records found on Cashfree for this order.",
        refunds: [],
      });
    }

    const latestRefund = refunds[refunds.length - 1];

    // If registrationId is provided, sync any updated status or bank ARN into Firestore
    if (registrationId && latestRefund) {
      try {
        const { db } = await import("@/lib/firebase/config");
        const { doc, updateDoc } = await import("firebase/firestore");
        if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
          const updatePayload: Record<string, any> = {
            refundStatus: latestRefund.refund_status === "SUCCESS" ? "PROCESSED" : latestRefund.refund_status,
            refundId: latestRefund.refund_id || latestRefund.cf_refund_id,
            refundAmount: latestRefund.refund_amount,
          };
          if (latestRefund.refund_arn) {
            updatePayload.refundArn = latestRefund.refund_arn;
          }
          if (latestRefund.refund_mode) {
            updatePayload.refundMode = latestRefund.refund_mode;
          }
          if (latestRefund.processed_at) {
            updatePayload.refundedAt = latestRefund.processed_at;
          }

          await updateDoc(doc(db, "registrations", registrationId), updatePayload);
        }
      } catch (syncErr) {
        console.warn("Notice: could not sync refund status to Firestore:", syncErr);
      }
    }

    return NextResponse.json({
      success: true,
      hasRefund: true,
      latestRefund,
      refunds,
    });
  } catch (error: any) {
    console.error("Cashfree refund status query error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch refund status from Cashfree.",
      },
      { status: 500 }
    );
  }
}
