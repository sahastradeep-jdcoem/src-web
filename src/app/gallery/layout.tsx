import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/data/seoMetadata";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Browse photos and highlights from events, fests, and campus activities organized by the Student Representative Council at JDCOEM Nagpur.",
  alternates: {
    canonical: "https://www.srcjdcoem.in/gallery",
  },
  openGraph: {
    title: "Gallery | SAHASTRADEEP • SRC JDCOEM",
    description: "Photo gallery from SRC JDCOEM events, flagship fests, and campus moments.",
    url: "https://www.srcjdcoem.in/gallery",
    siteName: "Sahastradeep - SRC JDCOEM",
    images: DEFAULT_OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "Gallery | SAHASTRADEEP • SRC JDCOEM",
    description: "Photo gallery from SRC JDCOEM events, flagship fests, and campus moments.",
    images: DEFAULT_TWITTER_IMAGES,
  },
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
