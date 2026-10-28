import { NextRequest, NextResponse } from "next/server";
import {
  getInstamojoPaymentRequest,
  confirmInstamojoOrderRegistration,
  getServerInstamojoCredentials,
} from "@/lib/instamojo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, paymentRequestId } = body;
    const targetId = paymentRequestId || orderId;

    if (!targetId || typeof targetId !== "string") {
      return NextResponse.json(
        { success: false, error: "Payment Request ID or Order ID is required for verification." },
        { status: 400 }
      );
    }

    const creds = await getServerInstamojoCredentials();
    const pr = await getInstamojoPaymentRequest(targetId, creds);

    const successfulPayment = pr.payments?.find(
      (p) => p.status === "Credit" || p.status === "Successful" || p.status === "completed"
    );
    const isPaid = pr.status === "Completed" || Boolean(successfulPayment);

    let registrationInfo: any = null;
    if (isPaid) {
      const confirmResult = await confirmInstamojoOrderRegistration(targetId, creds);
      if (confirmResult.success) {
        registrationInfo = confirmResult.registration;
      }
    }

    return NextResponse.json({
      success: true,
      orderId: pr.id,
      paymentRequestId: pr.id,
      status: pr.status,
      isPaid,
      amount: pr.amount,
      payment: successfulPayment
        ? {
            paymentId: successfulPayment.payment_id,
            status: successfulPayment.status,
            amount: successfulPayment.amount,
            buyerName: successfulPayment.buyer_name,
            buyerPhone: successfulPayment.buyer_phone,
            createdAt: successfulPayment.created_at,
          }
        : null,
      registration: registrationInfo,
    });
  } catch (error: any) {
    console.error("Instamojo verify-order error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to verify Instamojo order status.",
      },
      { status: 500 }
    );
  }
}
