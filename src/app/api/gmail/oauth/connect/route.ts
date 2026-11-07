import { NextRequest, NextResponse } from "next/server";
import { getGmailOAuthConfig } from "@/lib/payments/gmailOAuth";

export async function GET(req: NextRequest) {
  try {
    const config = await getGmailOAuthConfig();
    if (!config?.clientId) {
      return NextResponse.json({ 
        success: false, 
        error: "Google OAuth Client ID is not configured. Please configure it in payments settings or environment variables." 
      }, { status: 400 });
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "srcjdcoem.in";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;
    const redirectUri = `${origin}/api/gmail/oauth/callback`;

    // Encode redirectUri and anti-CSRF token in state to ensure identical redirectUri during code exchange
    const state = Buffer.from(JSON.stringify({
      nonce: Math.random().toString(36).substring(2, 15),
      redirectUri
    })).toString("base64");

    const scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email"
    ].join(" ");

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes,
      access_type: "offline",
      prompt: "consent",
      state
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    // If caller requests redirect directly via query ?redirect=true
    if (req.nextUrl.searchParams.get("redirect") === "true") {
      return NextResponse.redirect(authUrl);
    }

    return NextResponse.json({
      success: true,
      authUrl,
      redirectUri
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
