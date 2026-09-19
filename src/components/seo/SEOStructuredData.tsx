import React from "react";
import { JsonLd } from "./JsonLd";
import { getSEOLeadershipData } from "@/lib/seo/getSEOLeadershipData";

/**
 * Async Server Component that fetches the current tenure + leadership
 * data from Firestore and renders both WebSite and Organization JSON-LD
 * schemas in the page head.
 *
 * This component MUST be used in a Server Component context (e.g., layout.tsx).
 * It cannot be used in a "use client" component.
 *
 * The dynamic data ensures Google's AI Overview uses the correct tenure year
 * and council member names instead of inferring/hallucinating them.
 */
export default async function SEOStructuredData() {
  const leadershipData = await getSEOLeadershipData();

  return (
    <>
      <JsonLd type="WebSite" />
      <JsonLd type="Organization" leadershipData={leadershipData} />
    </>
  );
}
