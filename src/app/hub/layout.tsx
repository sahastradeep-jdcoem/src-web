import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/data/seoMetadata";

export const metadata: Metadata = {
  title: "Hub",
  description: "Explore opportunities, vote on campus polls, apply for campus initiatives and programs, submit creative entries, and file confidential student concerns on the SRC JDCOEM Student Engagement Hub.",
  alternates: {
    canonical: "https://www.srcjdcoem.in/hub",
  },
  openGraph: {
    title: "Hub | SAHASTRADEEP • SRC JDCOEM",
    description: "Explore opportunities, campus polls, applications, contests, and student support on the SRC JDCOEM Student Engagement Hub.",
    url: "https://www.srcjdcoem.in/hub",
    siteName: "Sahastradeep - SRC JDCOEM",
    images: DEFAULT_OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "Hub | SAHASTRADEEP • SRC JDCOEM",
    description: "Explore opportunities, campus polls, applications, contests, and student support on the SRC JDCOEM Student Engagement Hub.",
    images: DEFAULT_TWITTER_IMAGES,
  },
};

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
