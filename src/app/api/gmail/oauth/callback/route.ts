import { NextRequest, NextResponse } from "next/server";
import { getGmailOAuthConfig, saveGmailConnection } from "@/lib/payments/gmailOAuth";

declare global {
  var _latestGmailAuthToken: any;
}

export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "srcjdcoem.in";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const origin = `${proto}://${host}`;
  let redirectUri = `${origin}/api/gmail/oauth/callback`;

  // Decode state to retrieve exact redirectUri used during the initial request
  const stateParam = req.nextUrl.searchParams.get("state");
  if (stateParam) {
    try {
      const parsed = JSON.parse(Buffer.from(stateParam, "base64").toString("utf-8"));
      if (parsed?.redirectUri) {
        redirectUri = parsed.redirectUri;
      }
    } catch {}
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    console.warn("Gmail OAuth callback received error or no code:", error);
    return NextResponse.redirect(`${origin}/admin/payments?gmail_error=${encodeURIComponent(error || "no_code")}`);
  }

  try {
    const config = await getGmailOAuthConfig();
    if (!config?.clientId || !config?.clientSecret) {
      return NextResponse.redirect(`${origin}/admin/payments?gmail_error=missing_credentials`);
    }

    // Exchange auth code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Failed to exchange Google OAuth code:", errText);
      return NextResponse.redirect(`${origin}/admin/payments?gmail_error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // Fetch user profile to display connected email
    let userEmail = "";
    let userName = "";
    let userAvatar = "";

    try {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        userEmail = userData.email || "";
        userName = userData.name || "";
        userAvatar = userData.picture || "";
      }
    } catch (userErr) {
      console.warn("Notice: could not fetch Google user profile:", userErr);
    }

    const tokenRecord = {
      connected: true,
      email: userEmail,
      name: userName,
      avatar: userAvatar,
      accessToken,
      refreshToken: refreshToken || "",
      expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
      connectedAt: new Date().toISOString(),
      tenureId: "2026-2027"
    };

    // Stash in global memory for direct client pickup via /api/gmail/oauth/pending
    (global as any)._latestGmailAuthToken = tokenRecord;

    // Server-side best-effort Firestore write
    await saveGmailConnection(tokenRecord).catch((e) => {
      console.warn("Server saveGmailConnection notice:", e);
    });

    const response = NextResponse.redirect(
      `${origin}/admin/payments?gmail_connected=success&email=${encodeURIComponent(userEmail)}&auth_sync=1`
    );

    const tokenBundleStr = JSON.stringify(tokenRecord);

    // Standard cookies
    response.cookies.set("src_gmail_connected", "true", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });
    if (userEmail) {
      response.cookies.set("src_gmail_email", userEmail, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });
    }
    response.cookies.set("src_gmail_token_bundle", tokenBundleStr, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false
    });

    // Domain-wide cookies for apex and subdomains (.srcjdcoem.in)
    if (host.includes("srcjdcoem.in")) {
      response.cookies.set("src_gmail_connected_shared", "true", { path: "/", domain: ".srcjdcoem.in", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });
      if (userEmail) {
        response.cookies.set("src_gmail_email_shared", userEmail, { path: "/", domain: ".srcjdcoem.in", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });
      }
      response.cookies.set("src_gmail_token_bundle_shared", tokenBundleStr, {
        path: "/",
        domain: ".srcjdcoem.in",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        httpOnly: false
      });
    }

    return response;
  } catch (err: any) {
    console.error("Gmail OAuth callback exception:", err);
    return NextResponse.redirect(`${origin}/admin/payments?gmail_error=${encodeURIComponent(err.message)}`);
  }
}
