import { NextRequest, NextResponse } from "next/server";
import { clearGmailConnection, getStoredGmailConnection } from "@/lib/payments/gmailOAuth";

declare global {
  var _latestGmailAuthToken: any;
}

export async function POST(req: NextRequest) {
  try {
    const connection = await getStoredGmailConnection();
    const token = connection?.refreshToken || connection?.accessToken;

    // Best-effort token revocation with Google
    if (token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
      } catch (revokeErr) {
        console.warn("Notice: token revocation warning:", revokeErr);
      }
    }

    await clearGmailConnection().catch(() => {});

    if (typeof global !== "undefined") {
      (global as any)._latestGmailAuthToken = null;
    }

    const response = NextResponse.json({ success: true, message: "Disconnected successfully" });

    // Clear standard cookies
    const cookieNames = [
      "src_gmail_connected",
      "src_gmail_email",
      "src_gmail_token_bundle",
      "src_gmail_connected_shared",
      "src_gmail_email_shared",
      "src_gmail_token_bundle_shared"
    ];

    cookieNames.forEach((name) => {
      response.cookies.set(name, "", { path: "/", maxAge: 0, expires: new Date(0) });
      response.cookies.set(name, "", { path: "/", domain: ".srcjdcoem.in", maxAge: 0, expires: new Date(0) });
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: true, warning: err.message });
  }
}
