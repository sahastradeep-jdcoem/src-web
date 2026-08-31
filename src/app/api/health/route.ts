import { NextResponse } from "next/server";

export async function GET() {
  const isFirebaseConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const isRazorpayConfigured = Boolean(
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
  );

  return NextResponse.json(
    {
      status: "healthy",
      service: "SRC JDCOEM Sahastradeep Portal",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      integrations: {
        firebase: isFirebaseConfigured ? "configured" : "fallback_mode",
        razorpay: isRazorpayConfigured ? "configured" : "sandbox_mode",
      },
      version: "1.0.0-prod",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
