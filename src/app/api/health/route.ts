import { NextResponse } from "next/server";

export async function GET() {
  const isFirebaseConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const isPaytmConfigured = Boolean(
    (process.env.PAYTM_MID || process.env.NEXT_PUBLIC_PAYTM_MID) && process.env.PAYTM_MERCHANT_KEY
  );

  return NextResponse.json(
    {
      status: "healthy",
      service: "SRC JDCOEM Sahastradeep Portal",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      integrations: {
        firebase: isFirebaseConfigured ? "configured" : "fallback_mode",
        paytm: isPaytmConfigured ? "configured" : "upi_direct_mode",
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
