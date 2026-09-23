import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSiteContentFromFirestore } from "@/lib/firebase/firestore";
import { HeroSettings, DEFAULT_HERO_SETTINGS } from "@/data/heroSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let heroSettings: HeroSettings = DEFAULT_HERO_SETTINGS;
    try {
      const remote = await getSiteContentFromFirestore<HeroSettings>("hero_settings");
      if (remote) {
        heroSettings = { ...DEFAULT_HERO_SETTINGS, ...remote };
      }
    } catch (err) {
      console.warn("[opengraph-image route] Firestore fetch failed, using fallback:", err);
    }

    const rawOgImageUrl = (heroSettings.ogImageUrl || "").trim();

    // 1. If custom image is a remote HTTP/HTTPS URL (e.g. Firebase Storage)
    if (rawOgImageUrl.startsWith("http")) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const imgRes = await fetch(rawOgImageUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          const contentType = imgRes.headers.get("content-type") || "image/jpeg";
          return new Response(buffer, {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            },
          });
        }
      } catch (err) {
        console.warn("[opengraph-image route] Remote image fetch failed, using fallback:", err);
      }
    }

    // 2. If custom image is an inline base64 data URL
    if (rawOgImageUrl.startsWith("data:image")) {
      const match = rawOgImageUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const buffer = Buffer.from(match[2], "base64");
        return new Response(buffer, {
          headers: {
            "Content-Type": mimeType,
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          },
        });
      }
    }

    // 3. Fallback: Serve static public/og-image.png
    try {
      const fallbackPath = path.join(process.cwd(), "public/og-image.png");
      if (fs.existsSync(fallbackPath)) {
        const fileBuffer = fs.readFileSync(fallbackPath);
        return new Response(fileBuffer, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          },
        });
      }
    } catch (fsErr) {
      console.warn("[opengraph-image route] Could not read public/og-image.png from fs:", fsErr);
    }

    // 4. Ultimate redirect fallback to /og-image.png
    return NextResponse.redirect(new URL("/og-image.png", "https://www.srcjdcoem.in"), 307);
  } catch (globalErr) {
    console.error("[opengraph-image route] Fatal error:", globalErr);
    return NextResponse.redirect(new URL("/og-image.png", "https://www.srcjdcoem.in"), 307);
  }
}
