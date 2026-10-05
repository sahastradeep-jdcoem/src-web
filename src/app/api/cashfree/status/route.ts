import { NextResponse } from "next/server";
import { getServerCashfreeCredentials } from "@/lib/cashfree";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const creds = await getServerCashfreeCredentials();
    const hasAppId = Boolean(creds.appId);
    const hasSecretKey = Boolean(creds.secretKey);

    let appIdMasked = "Not configured";
    if (hasAppId) {
      if (creds.appId.length > 8) {
        appIdMasked = `${creds.appId.slice(0, 4)}••••••••${creds.appId.slice(-4)}`;
      } else {
        appIdMasked = `${creds.appId.slice(0, 2)}••••`;
      }
    }

    return NextResponse.json({
      configured: hasAppId && hasSecretKey,
      hasAppId,
      hasSecretKey,
      appIdMasked,
      environment: creds.environment,
      source: "Vercel Environment Variables",
    });
  } catch (error: any) {
    return NextResponse.json(
      { configured: false, error: error.message || "Failed to check gateway status" },
      { status: 500 }
    );
  }
}
