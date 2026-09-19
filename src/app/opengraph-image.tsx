import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";
import { getSiteContentFromFirestore } from "@/lib/firebase/firestore";
import { HeroSettings, DEFAULT_HERO_SETTINGS } from "@/data/heroSettings";

export const runtime = "nodejs";
export const alt = "SAHASTRADEEP | Student Representative Council • JDCOEM Nagpur";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  // 1. Fetch real-time hero settings from Firestore to check for admin custom OG banner or text
  let heroSettings: HeroSettings = DEFAULT_HERO_SETTINGS;
  try {
    const remote = await getSiteContentFromFirestore<HeroSettings>("hero_settings");
    if (remote) {
      heroSettings = { ...DEFAULT_HERO_SETTINGS, ...remote };
    }
  } catch (e) {
    console.warn("Could not load hero_settings for OG image generator, using defaults:", e);
  }

  // 2. Read official logos from public directory to embed directly as base64 data URIs
  let srcLogoBase64 = "";
  let jdHeaderBase64 = "";

  try {
    const srcLogoPath = path.join(process.cwd(), "public/assets/SRC Logo.png");
    const srcLogoBuffer = fs.readFileSync(srcLogoPath);
    srcLogoBase64 = `data:image/png;base64,${srcLogoBuffer.toString("base64")}`;
  } catch (e) {
    console.warn("Could not read SRC Logo for OG image:", e);
  }

  try {
    const jdHeaderPath = path.join(process.cwd(), "public/assets/JD header W.png");
    const jdHeaderBuffer = fs.readFileSync(jdHeaderPath);
    jdHeaderBase64 = `data:image/png;base64,${jdHeaderBuffer.toString("base64")}`;
  } catch (e) {
    console.warn("Could not read JD header for OG image:", e);
  }

  // 3. Case A: Admin uploaded a custom 1200x630 banner photo (full image takeover)
  if (
    heroSettings.ogImageUrl &&
    (heroSettings.ogImageUrl.trim().startsWith("http") || heroSettings.ogImageUrl.trim().startsWith("data:image"))
  ) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            position: "relative",
            backgroundColor: "#0B1E3F",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroSettings.ogImageUrl}
            alt={heroSettings.ogTitle || "SAHASTRADEEP — SRC JDCOEM"}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />

          {/* Optional subtle bottom watermark badge for authenticity */}
          <div
            style={{
              position: "absolute",
              bottom: "24px",
              right: "28px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 18px",
              borderRadius: "999px",
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              color: "#FFFFFF",
              fontSize: "14px",
              fontWeight: 700,
              letterSpacing: "0.05em",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#E78023",
                display: "flex",
              }}
            />
            srcjdcoem.in
          </div>
        </div>
      ),
      {
        ...size,
      }
    );
  }

  // 4. Case B: Dynamic High-Fidelity Branded Card using Admin Typography & Presets
  const displayTitle = (heroSettings.ogTitle || "").trim() || "SAHASTRADEEP";
  const displayTagline = (heroSettings.ogDescription || "").trim() ||
    heroSettings.heroTagline ||
    "Official digital gateway to the Student Representative Council (SRC) of JDCOEM Nagpur.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0B1E3F 0%, #17458F 55%, #0B132B 100%)",
          padding: "60px 72px",
          color: "#FFFFFF",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle Ambient Decorative Glows */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-120px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(231,128,35,0.22) 0%, rgba(231,128,35,0) 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-150px",
            left: "-100px",
            width: "450px",
            height: "450px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(23,69,143,0.45) 0%, rgba(23,69,143,0) 70%)",
            filter: "blur(50px)",
          }}
        />

        {/* Top Institutional Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            zIndex: 10,
          }}
        >
          {jdHeaderBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={jdHeaderBase64}
              alt="JDCOEM"
              style={{
                height: "42px",
                objectFit: "contain",
              }}
            />
          ) : (
            <span
              style={{
                fontSize: "18px",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "rgba(255, 255, 255, 0.75)",
                fontWeight: 600,
              }}
            >
              JD College of Engineering & Management
            </span>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 18px",
              borderRadius: "999px",
              background: "rgba(255, 255, 255, 0.12)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#F8FAFC",
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#E78023",
                display: "flex",
              }}
            />
            srcjdcoem.in
          </div>
        </div>

        {/* Center Content Section */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            zIndex: 10,
            marginTop: "10px",
            marginBottom: "10px",
          }}
        >
          {/* Left Text Block */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: "760px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "14px",
              }}
            >
              <span
                style={{
                  color: "#E78023",
                  fontSize: "16px",
                  fontWeight: 800,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}
              >
                {heroSettings.heroOverline || "Autonomous Student Council"}
              </span>
            </div>

            <h1
              style={{
                fontSize: "64px",
                fontWeight: 900,
                letterSpacing: "-0.03em",
                margin: "0 0 16px 0",
                lineHeight: 1.05,
                color: "#FFFFFF",
              }}
            >
              {displayTitle}
            </h1>

            <p
              style={{
                fontSize: "24px",
                color: "#E2E8F0",
                lineHeight: 1.35,
                margin: 0,
                fontWeight: 500,
                maxWidth: "720px",
              }}
            >
              {displayTagline}
            </p>
          </div>

          {/* Right Logo Seal */}
          {srcLogoBase64 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "190px",
                height: "190px",
                borderRadius: "32px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                padding: "16px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={srcLogoBase64}
                alt="SRC Logo"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
          )}
        </div>

        {/* Bottom Metrics / Pillar Strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "24px",
            borderTop: "1px solid rgba(255, 255, 255, 0.14)",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", gap: "36px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF" }}>12+</span>
              <span style={{ fontSize: "13px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Chartered Clubs
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF" }}>Flagship</span>
              <span style={{ fontSize: "13px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Campus Fests
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "22px", fontWeight: 800, color: "#FFFFFF" }}>Verified</span>
              <span style={{ fontSize: "13px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Digital Passes
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#CBD5E1",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            <span>Nagpur, Maharashtra</span>
            <span>•</span>
            <span>An Autonomous Institute</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
