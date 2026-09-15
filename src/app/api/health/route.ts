import { NextResponse } from "next/server";

export async function GET() {
  const isFirebaseConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "src-jdcoem.firebasestorage.app";
  const isPaytmConfigured = Boolean(
    (process.env.PAYTM_MID || process.env.NEXT_PUBLIC_PAYTM_MID) && process.env.PAYTM_MERCHANT_KEY
  );

  return NextResponse.json(
    {
      status: "healthy",
      service: "SRC JDCOEM Sahastradeep Portal",
      plan: "Firebase Blaze (Pay-as-you-go)",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      integrations: {
        firebase: isFirebaseConfigured ? "configured" : "fallback_mode",
        storage: {
          status: isFirebaseConfigured ? "active" : "unconfigured",
          bucket: storageBucket,
          cdn: "Google Cloud CDN enabled",
        },
        paytm: isPaytmConfigured ? "configured" : "upi_direct_mode",
      },
      version: "1.1.0-blaze",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
