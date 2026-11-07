import { NextRequest, NextResponse } from "next/server";
import { getGmailOAuthConfig, getStoredGmailConnection, getFreshAccessToken, saveGmailConnection } from "@/lib/payments/gmailOAuth";

declare global {
  var _latestGmailAuthToken: any;
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const config = await getGmailOAuthConfig();
    let connection = await getStoredGmailConnection();

    // 1. Direct tokens from authenticated admin client body
    if (body?.accessToken || body?.refreshToken) {
      connection = {
        ...(connection || {}),
        connected: true,
        email: body.email || connection?.email || "",
        accessToken: body.accessToken || connection?.accessToken || "",
        refreshToken: body.refreshToken || connection?.refreshToken || "",
        expiresAt: body.expiresAt || connection?.expiresAt || (Date.now() + 3600 * 1000)
      };
    }

    // 2. In-memory global pending token (from recent OAuth callback)
    if ((!connection?.accessToken && !connection?.refreshToken) && typeof global !== "undefined" && (global as any)._latestGmailAuthToken) {
      const pending = (global as any)._latestGmailAuthToken;
      if (pending?.accessToken || pending?.refreshToken) {
        connection = {
          ...(connection || {}),
          ...pending
        };
      }
    }

    // 3. Cookie fallback
    if (!connection?.accessToken && !connection?.refreshToken) {
      const cookieBundle =
        req.cookies.get("src_gmail_token_bundle")?.value ||
        req.cookies.get("src_gmail_token_bundle_shared")?.value;
      if (cookieBundle) {
        try {
          const parsed = JSON.parse(cookieBundle);
          if (parsed?.accessToken || parsed?.refreshToken) {
            connection = {
              ...(connection || {}),
              connected: true,
              email: parsed.email || connection?.email,
              accessToken: parsed.accessToken,
              refreshToken: parsed.refreshToken,
              expiresAt: parsed.expiresAt,
              connectedAt: parsed.connectedAt
            };
          }
        } catch {}
      }
    }

    if (!connection?.connected || (!connection?.accessToken && !connection?.refreshToken)) {
      return NextResponse.json({
        success: false,
        error: "Gmail account is not connected. Please connect treasurer Gmail with Google first."
      }, { status: 400 });
    }

    // Resolve Access Token (use active accessToken or refresh using refreshToken)
    let accessToken = connection.accessToken;
    const isExpired = connection.expiresAt && Date.now() >= (connection.expiresAt - 60000);

    if ((!accessToken || isExpired) && connection.refreshToken && config) {
      const fresh = await getFreshAccessToken(connection.refreshToken, config);
      if (fresh) {
        accessToken = fresh;
        connection.accessToken = fresh;
        connection.expiresAt = Date.now() + 3500 * 1000;
        await saveGmailConnection(connection).catch(() => {});
      }
    }

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: "Google access token has expired. Please click 'Connect with Google' to re-authenticate."
      }, { status: 401 });
    }

    // Query Gmail REST API for unread bank credit alert emails
    const searchQuery = 'label:unread (from:canarabank OR from:hdfcbank OR from:paytm OR from:sbi OR from:icicibank OR from:axisbank OR "credited" OR "credit alert" OR "UPI Ref")';
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listRes.ok) {
      const errText = await listRes.text();
      return NextResponse.json({
        success: false,
        error: `Gmail API search returned error ${listRes.status}: ${errText}`
      }, { status: 502 });
    }

    const listData = await listRes.json();
    const messageSummaries = listData.messages || [];

    if (messageSummaries.length === 0) {
      await saveGmailConnection({
        ...connection,
        lastSyncedAt: new Date().toISOString()
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: "Inbox checked — no unread bank alert emails found.",
        processedCount: 0,
        syncedAt: new Date().toISOString()
      });
    }

    // Process each unread email
    const processedResults: any[] = [];
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "srcjdcoem.in";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const internalWebhookUrl = `${proto}://${host}/api/upi/webhook?secret=SRC_UPI_2026_GATEWAY&source=Gmail`;

    for (const item of messageSummaries) {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!msgRes.ok) continue;

        const msgData = await msgRes.json();
        const headers = msgData.payload?.headers || [];
        const subject = headers.find((h: any) => h.name.toLowerCase() === "subject")?.value || "";
        const from = headers.find((h: any) => h.name.toLowerCase() === "from")?.value || "";
        const dateHeader = headers.find((h: any) => h.name.toLowerCase() === "date")?.value || "";
        const snippet = msgData.snippet || "";

        // Extract body text from parts or body
        let bodyText = snippet;
        if (msgData.payload?.body?.data) {
          try {
            bodyText = Buffer.from(msgData.payload.body.data, "base64").toString("utf-8");
          } catch {}
        } else if (msgData.payload?.parts) {
          for (const part of msgData.payload.parts) {
            if (part.mimeType === "text/plain" && part.body?.data) {
              try {
                bodyText = Buffer.from(part.body.data, "base64").toString("utf-8");
                break;
              } catch {}
            }
          }
        }

        // Post to internal webhook processor
        const webhookRes = await fetch(internalWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-src-webhook-key": "SRC_UPI_2026_GATEWAY"
          },
          body: JSON.stringify({
            packageName: "com.google.android.gm",
            sender: from,
            subject,
            body: bodyText,
            notificationText: `${subject} ${bodyText}`.slice(0, 1000),
            postTime: dateHeader ? new Date(dateHeader).getTime() : Date.now()
          })
        });

        const webhookData = await webhookRes.json();

        // Mark as read in Gmail (remove UNREAD label)
        try {
          await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}/modify`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              removeLabelIds: ["UNREAD"]
            })
          });
        } catch (modErr) {
          console.warn("Could not remove UNREAD label on message:", item.id, modErr);
        }

        processedResults.push({
          messageId: item.id,
          subject,
          from,
          result: webhookData
        });
      } catch (itemErr) {
        console.warn("Error processing individual Gmail message:", item.id, itemErr);
      }
    }

    await saveGmailConnection({
      ...connection,
      lastSyncedAt: new Date().toISOString()
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Processed ${processedResults.length} unread bank alert email(s).`,
      processedCount: processedResults.length,
      processed: processedResults,
      syncedAt: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
