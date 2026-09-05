import React from "react";

interface JsonLdProps {
  type?: "Organization" | "WebSite" | "Event";
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

export function JsonLd({ type = "Organization", eventData }: JsonLdProps) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://srcjdcoem.in";

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

  const organizationSchema = {
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

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
    />
  );
}
