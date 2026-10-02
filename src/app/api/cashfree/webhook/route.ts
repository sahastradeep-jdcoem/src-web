import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
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
