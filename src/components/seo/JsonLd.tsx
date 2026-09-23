import React from "react";

interface LeaderEntry {
  name: string;
  role: string;
}

interface JsonLdProps {
  type?: "Organization" | "WebSite" | "Event";
  /** Council leadership data for Organization schema — provides authoritative tenure info to Google */
  leadershipData?: {
    tenureLabel: string;
    academicYear: string;
    startDate?: string;
    leaders: LeaderEntry[];
  };
  eventData?: {
    name: string;
    description: string;
    startDate: string;
    locationName: string;
    url: string;
    image?: string;
    isPaid?: boolean;
    price?: number;
  };
}

export function JsonLd({ type = "Organization", leadershipData, eventData }: JsonLdProps) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.srcjdcoem.in";

  /* ── WebSite Schema ── */
  if (type === "WebSite") {
    const websiteSchema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Sahastradeep - SRC JDCOEM",
      alternateName: [
        "SRC JDCOEM",
        "Sahastradeep",
        "SAHASTRADEEP",
        "Student Representative Council JDCOEM",
        "SRC JDCOEM Nagpur",
        "SAHASTRADEEP — SRC JDCOEM",
        "JDCOEM SRC",
      ],
      url: "https://www.srcjdcoem.in",
    };

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
    );
  }

  /* ── Event Schema ── */
  if (type === "Event" && eventData) {
    const eventSchema = {
      "@context": "https://schema.org",
      "@type": "Event",
      name: eventData.name,
      description: eventData.description,
      startDate: eventData.startDate,
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      location: {
        "@type": "Place",
        name: eventData.locationName || "JD College of Engineering & Management Campus",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Nagpur",
          addressRegion: "Maharashtra",
          postalCode: "441501",
          addressCountry: "IN",
        },
      },
      image: [eventData.image || `${baseUrl}/assets/SRC Logo.png`],
      organizer: {
        "@type": "Organization",
        name: "Student Representative Council (SRC) — JDCOEM",
        url: baseUrl,
      },
      offers: {
        "@type": "Offer",
        url: eventData.url,
        price: eventData.isPaid ? String(eventData.price || 0) : "0",
        priceCurrency: "INR",
        availability: "https://schema.org/InStock",
        validFrom: new Date().toISOString().split("T")[0],
      },
    };

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
      />
    );
  }

  /* ── Organization Schema (with optional leadership structured data) ── */
  const organizationSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "Student Representative Council (SRC) — JDCOEM Nagpur",
    alternateName: "Sahastradeep",
    url: baseUrl,
    logo: `${baseUrl}/assets/SRC Logo.png`,
    description:
      "Official Student Representative Council of JD College of Engineering and Management, Nagpur. Empowering students, coordinating 12 professional and cultural club charters, organizing university fests, and fostering campus leadership.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Khandala, Post Valni, Near Hanuman Temple, Borgaon Dam, Katol Road",
      addressLocality: "Nagpur",
      addressRegion: "Maharashtra",
      postalCode: "441501",
      addressCountry: "IN",
    },
    parentOrganization: {
      "@type": "CollegeOrUniversity",
      name: "JD College of Engineering and Management (JDCOEM)",
      url: "https://jdcoem.ac.in",
    },
    sameAs: [
      "https://www.instagram.com/src_jdcoem",
      "https://www.linkedin.com/school/jd-college-of-engineering-management",
    ],
  };

  // Add leadership structured data if provided — this gives Google authoritative
  // tenure year + leader info, preventing AI Overview hallucinations about tenure years
  if (leadershipData && leadershipData.leaders.length > 0) {
    // Derive start/end dates from tenure label (e.g. "2025-26" → Aug 2025 – Jul 2026)
    const labelParts = leadershipData.tenureLabel.split("-");
    const startYear = labelParts[0] ? `20${labelParts[0].slice(-2)}` : undefined;
    const endYear = labelParts[1] ? `20${labelParts[1]}` : undefined;
    const startDateISO = leadershipData.startDate || (startYear ? `${startYear}-08` : undefined);
    const endDateISO = endYear ? `${endYear}-07` : undefined;

    organizationSchema.member = leadershipData.leaders.map((leader) => ({
      "@type": "OrganizationRole",
      member: {
        "@type": "Person",
        name: leader.name,
      },
      roleName: leader.role,
      ...(startDateISO ? { startDate: startDateISO } : {}),
      ...(endDateISO ? { endDate: endDateISO } : {}),
    }));

    // Also add a description snippet with explicit tenure year
    organizationSchema.description =
      `Official Student Representative Council of JD College of Engineering and Management, Nagpur. ` +
      `Currently in its ${leadershipData.academicYear} academic session. ` +
      `Empowering students, coordinating 12 professional and cultural club charters, organizing university fests, and fostering campus leadership.`;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
    />
  );
}
