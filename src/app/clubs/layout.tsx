import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/data/seoMetadata";

export const metadata: Metadata = {
  title: "Clubs",
  description: "Explore 12 chartered student clubs under the Student Representative Council at JDCOEM Nagpur — technical, cultural, sports, and creative societies.",
  alternates: {
    canonical: "https://www.srcjdcoem.in/clubs",
  },
  openGraph: {
    title: "Clubs | SAHASTRADEEP • SRC JDCOEM",
    description: "Discover 12 student clubs under SRC JDCOEM Nagpur — from coding and robotics to dance, music, and drama.",
    url: "https://www.srcjdcoem.in/clubs",
    siteName: "Sahastradeep - SRC JDCOEM",
    images: DEFAULT_OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "Clubs | SAHASTRADEEP • SRC JDCOEM",
    description: "Discover 12 student clubs under SRC JDCOEM Nagpur.",
    images: DEFAULT_TWITTER_IMAGES,
  },
};

export default function ClubsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
