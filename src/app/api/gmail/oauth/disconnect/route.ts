import { NextRequest, NextResponse } from "next/server";
import { clearGmailConnection, getGmailOAuthConfig, getStoredGmailConnection } from "@/lib/payments/gmailOAuth";

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

    const cleared = await clearGmailConnection();
    return NextResponse.json({ success: cleared });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
