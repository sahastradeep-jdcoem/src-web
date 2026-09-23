import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/data/seoMetadata";

export const metadata: Metadata = {
  title: "Events",
  description: "Explore flagship collegiate fests, hackathons, cultural nights, and student-led events organized by the Student Representative Council at JDCOEM Nagpur.",
  alternates: {
    canonical: "https://www.srcjdcoem.in/events",
  },
  openGraph: {
    title: "Events | SAHASTRADEEP • SRC JDCOEM",
    description: "Discover upcoming and past events organized by SRC JDCOEM Nagpur — flagship fests, hackathons, and campus competitions.",
    url: "https://www.srcjdcoem.in/events",
    siteName: "Sahastradeep - SRC JDCOEM",
    images: DEFAULT_OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "Events | SAHASTRADEEP • SRC JDCOEM",
    description: "Discover upcoming and past events organized by SRC JDCOEM Nagpur.",
    images: DEFAULT_TWITTER_IMAGES,
  },
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
