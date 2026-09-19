import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Browse photos and highlights from events, fests, and campus activities organized by the Student Representative Council at JDCOEM Nagpur.",
  openGraph: {
    title: "Gallery | SAHASTRADEEP • SRC JDCOEM",
    description: "Photo gallery from SRC JDCOEM events, flagship fests, and campus moments.",
    url: "https://srcjdcoem.in/gallery",
    siteName: "SAHASTRADEEP — SRC JDCOEM",
  },
  twitter: {
    card: "summary",
    title: "Gallery | SAHASTRADEEP • SRC JDCOEM",
    description: "Photo gallery from SRC JDCOEM events, flagship fests, and campus moments.",
  },
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
