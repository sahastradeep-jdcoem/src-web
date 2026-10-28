import { NextRequest, NextResponse } from "next/server";
import { confirmInstamojoOrderRegistration } from "@/lib/instamojo";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const paymentId = searchParams.get("payment_id");
    const paymentStatus = searchParams.get("payment_status");
    const paymentRequestId = searchParams.get("payment_request_id");
    const eventSlug = searchParams.get("event_slug");
    const isTest = searchParams.get("test") === "1";

    const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || "https://www.srcjdcoem.in";
    const siteUrl = origin.replace("://srcjdcoem.in", "://www.srcjdcoem.in");

    if (isTest) {
      return NextResponse.redirect(`${siteUrl}/admin/registrations?instamojo_verified=1`);
    }

    if (!paymentRequestId) {
      return NextResponse.redirect(`${siteUrl}/events?error=missing_payment_request`);
    }

    if (paymentStatus === "Credit" || paymentStatus === "Successful" || paymentStatus === "completed") {
      // Auto-confirm the registration into Firestore
      try {
        await confirmInstamojoOrderRegistration(paymentRequestId);
      } catch (confirmErr) {
        console.warn("Notice: Instamojo callback confirmation warning:", confirmErr);
      }

      const redirectPath = eventSlug
        ? `${siteUrl}/events/${eventSlug}/register?order_id=${encodeURIComponent(paymentRequestId)}&gateway=instamojo`
        : `${siteUrl}/events?order_id=${encodeURIComponent(paymentRequestId)}&gateway=instamojo`;

      return NextResponse.redirect(redirectPath);
    }

    // Payment failed or cancelled
    const failPath = eventSlug
      ? `${siteUrl}/events/${eventSlug}/register?payment_failed=1`
      : `${siteUrl}/events?payment_failed=1`;

    return NextResponse.redirect(failPath);
  } catch (err: any) {
    console.error("Instamojo callback error:", err);
    const origin = req.nextUrl.origin || "https://www.srcjdcoem.in";
    return NextResponse.redirect(`${origin}/events?error=payment_error`);
  }
}
