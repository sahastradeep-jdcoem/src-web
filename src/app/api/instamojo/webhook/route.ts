import { NextRequest, NextResponse } from "next/server";
import {
  getServerInstamojoCredentials,
  verifyInstamojoWebhookMac,
  confirmInstamojoOrderRegistration,
} from "@/lib/instamojo";

export async function POST(req: NextRequest) {
  try {
    let payload: Record<string, any> = {};

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        payload[key] = value.toString();
      });
    } else {
      payload = await req.json().catch(() => ({}));
    }

    const paymentRequestId = payload.payment_request_id || payload.payment_id;
    if (!paymentRequestId) {
      return NextResponse.json(
        { success: false, error: "Missing payment_request_id" },
        { status: 400 }
      );
    }

    const creds = await getServerInstamojoCredentials();

    // Verify MAC if provided
    if (payload.mac && creds.salt) {
      const isMacValid = verifyInstamojoWebhookMac(payload, creds.salt);
      if (!isMacValid) {
        console.warn("Invalid MAC signature in Instamojo webhook for", paymentRequestId);
        return NextResponse.json({ success: false, error: "Invalid MAC signature" }, { status: 401 });
      }
    }

    const status = payload.status;
    if (status === "Credit" || status === "Successful" || status === "completed") {
      const confirmResult = await confirmInstamojoOrderRegistration(paymentRequestId, creds);
      return NextResponse.json({
        success: true,
        confirmed: confirmResult.success,
        registrationId: confirmResult.registrationId,
      });
    }

    return NextResponse.json({
      success: true,
      status: "IGNORED",
      reason: `Payment status is ${status}`,
    });
  } catch (error: any) {
    console.error("Instamojo webhook processing error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Webhook error" },
      { status: 500 }
    );
  }
}
