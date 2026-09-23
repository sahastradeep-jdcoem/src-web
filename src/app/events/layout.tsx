import type { Metadata } from "next";

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
  },
  twitter: {
    card: "summary",
    title: "Events | SAHASTRADEEP • SRC JDCOEM",
    description: "Discover upcoming and past events organized by SRC JDCOEM Nagpur.",
  },
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
