import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/data/seoMetadata";

export const metadata: Metadata = {
  title: "Our Team",
  description: "Meet the Student Representative Council leadership team at JDCOEM Nagpur — President, Vice President, Mentor, and all council members.",
  alternates: {
    canonical: "https://www.srcjdcoem.in/team",
  },
  openGraph: {
    title: "Our Team | SAHASTRADEEP • SRC JDCOEM",
    description: "Meet the elected student leaders and council members of SRC JDCOEM Nagpur.",
    url: "https://www.srcjdcoem.in/team",
    siteName: "Sahastradeep - SRC JDCOEM",
    images: DEFAULT_OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "Our Team | SAHASTRADEEP • SRC JDCOEM",
    description: "Meet the elected student leaders and council members of SRC JDCOEM Nagpur.",
    images: DEFAULT_TWITTER_IMAGES,
  },
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
