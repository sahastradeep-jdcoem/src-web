import type { Metadata } from "next";
import { getEventFromFirestore, getAllEventsFromFirestore } from "@/lib/firebase/firestore";
import { EventItem } from "@/types";
import { DEFAULT_OG_IMAGES, DEFAULT_OG_IMAGE_URL } from "@/data/seoMetadata";


function getValidOgImageUrl(imgUrl?: string): string {
  if (!imgUrl) return DEFAULT_OG_IMAGE_URL;
  const trimmed = imgUrl.trim();
  // Social crawlers cannot fetch base64 data URLs; use fallback logo
  if (trimmed.startsWith("data:")) return DEFAULT_OG_IMAGE_URL;
  return trimmed;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  if (!slug) {
    return {
      title: "Event Details | SRC JDCOEM",
      description: "Explore collegiate fests, workshops, and competitions organized by the Student Representative Council at JDCOEM Nagpur.",
    };
  }

  let event: EventItem | null = null;

  try {
    event = await getEventFromFirestore(slug);
    if (!event) {
      const all = await getAllEventsFromFirestore();
      event = all.find((e) => e.slug === slug || e.id === slug) || null;
    }
  } catch (err) {
    console.warn(`[events/[slug]/layout] Failed to load event for metadata (${slug}):`, err);
  }

  // Comply with Draft Isolation Invariant (Directive #6)
  if (!event || event.isLive === false || event.status === "draft") {
    return {
      title: "Event Details",
      description: "Explore collegiate events, competitions, and festivals organized by the Student Representative Council at JDCOEM Nagpur.",
      alternates: {
        canonical: `https://www.srcjdcoem.in/events/${slug}`,
      },
      openGraph: {
        title: "Event Details | SAHASTRADEEP • SRC JDCOEM",
        description: "Explore collegiate events, competitions, and festivals organized by the Student Representative Council at JDCOEM Nagpur.",
        url: `https://www.srcjdcoem.in/events/${slug}`,
        siteName: "Sahastradeep - SRC JDCOEM",
        images: DEFAULT_OG_IMAGES,
      },
    };
  }

  const title = event.name;
  const rawDescription =
    event.tagline ||
    event.description ||
    `Official event organized by the Student Representative Council (SRC) at JDCOEM Nagpur.`;
  const cleanDescription =
    rawDescription.length > 200 ? `${rawDescription.slice(0, 197)}...` : rawDescription;

  // Directive: The event thumbnail image (cardImage priority, then posterImage, poster, headerImage)
  const thumbnailRaw = event.cardImage || event.posterImage || event.poster || event.headerImage;
  const ogImageUrl = getValidOgImageUrl(thumbnailRaw);

  const eventUrl = `https://www.srcjdcoem.in/events/${event.slug || slug}`;

  return {
    title: `${title} | SRC JDCOEM`,
    description: cleanDescription,
    alternates: {
      canonical: eventUrl,
    },
    openGraph: {
      title: `${title} | SRC JDCOEM`,
      description: cleanDescription,
      url: eventUrl,
      siteName: "Sahastradeep - SRC JDCOEM",
      type: "article",
      images: [
        {
          url: ogImageUrl,
          alt: `${title} thumbnail`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | SRC JDCOEM`,
      description: cleanDescription,
      images: [ogImageUrl],
    },
  };
}

export default function EventDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
