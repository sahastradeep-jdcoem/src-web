import { NextRequest, NextResponse } from "next/server";
import { getCashfreeOrder, getCashfreeOrderPayments, getServerCashfreeCredentials } from "@/lib/cashfree";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId } = body;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { success: false, error: "Order ID is required for verification." },
        { status: 400 }
      );
    }

    const creds = getServerCashfreeCredentials();
    const order = await getCashfreeOrder(orderId, creds);

    let isPaid = order.order_status === "PAID";
    let paymentDetails: any = null;

    try {
      const payments = await getCashfreeOrderPayments(orderId, creds);
      const successfulPayment = payments.find((p) => p.payment_status === "SUCCESS");

      if (successfulPayment) {
        isPaid = true;
        paymentDetails = {
          cfPaymentId: successfulPayment.cf_payment_id,
          utr: successfulPayment.bank_reference || `CF_${successfulPayment.cf_payment_id}`,
          amount: successfulPayment.payment_amount,
          paymentStatus: successfulPayment.payment_status,
          paymentTime: successfulPayment.payment_time,
          paymentMethod: successfulPayment.payment_group || "ONLINE",
          upiChannel: successfulPayment.payment_method?.upi?.channel || null,
        };
      }
    } catch (paymentErr) {
      console.warn("Could not fetch individual payment details:", paymentErr);
    }

    return NextResponse.json({
      success: true,
      orderId: order.order_id,
      cfOrderId: order.cf_order_id,
      orderStatus: order.order_status,
      isPaid,
      amount: order.order_amount,
      currency: order.order_currency,
      payment: paymentDetails,
    });
  } catch (error: any) {
    console.error("Cashfree order verification error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to verify Cashfree order status.",
      },
      { status: 500 }
    );
  }
}
