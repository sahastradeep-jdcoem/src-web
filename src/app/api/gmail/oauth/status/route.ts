import { NextRequest, NextResponse } from "next/server";
import { getGmailOAuthConfig, getStoredGmailConnection, saveGmailOAuthConfig } from "@/lib/payments/gmailOAuth";

export async function GET(req: NextRequest) {
  try {
    const config = await getGmailOAuthConfig();
    const connection = await getStoredGmailConnection();

    const cookieConnected = req.cookies.get("src_gmail_connected")?.value === "true";
    const cookieEmail = req.cookies.get("src_gmail_email")?.value;

    const isConnected = Boolean(
      (connection?.connected && (connection?.email || connection?.accessToken || connection?.refreshToken)) ||
      (cookieConnected && cookieEmail)
    );

    return NextResponse.json({
      success: true,
      hasCredentials: Boolean(config?.clientId && config?.clientSecret),
      clientId: config?.clientId ? `${config.clientId.slice(0, 12)}...` : null,
      connection: {
        connected: isConnected,
        email: connection?.email || cookieEmail || null,
        name: connection?.name || null,
        avatar: connection?.avatar || null,
        connectedAt: connection?.connectedAt || null,
        lastSyncedAt: connection?.lastSyncedAt || null,
        tenureId: connection?.tenureId || null
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, clientSecret } = body;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ success: false, error: "Missing Client ID or Client Secret" }, { status: 400 });
    }

    const result = await saveGmailOAuthConfig(clientId, clientSecret);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || "Failed to persist credentials" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
