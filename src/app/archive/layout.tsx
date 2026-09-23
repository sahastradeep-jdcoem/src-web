import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/data/seoMetadata";

export const metadata: Metadata = {
  title: "Archive",
  description: "Explore historical records, past tenures, legacy leadership rosters, and achievements of the Student Representative Council at JDCOEM Nagpur.",
  alternates: {
    canonical: "https://www.srcjdcoem.in/archive",
  },
  openGraph: {
    title: "Archive | SAHASTRADEEP • SRC JDCOEM",
    description: "Historical records, previous tenures, and past council rosters of SRC JDCOEM Nagpur.",
    url: "https://www.srcjdcoem.in/archive",
    siteName: "Sahastradeep - SRC JDCOEM",
    images: DEFAULT_OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "Archive | SAHASTRADEEP • SRC JDCOEM",
    description: "Historical records, previous tenures, and past council rosters of SRC JDCOEM Nagpur.",
    images: DEFAULT_TWITTER_IMAGES,
  },
};

export default function ArchiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
