import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/data/seoMetadata";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the Student Representative Council (SRC) of JDCOEM Nagpur for queries, club collaborations, sponsorship, or grievance submissions.",
  alternates: {
    canonical: "https://www.srcjdcoem.in/contact",
  },
  openGraph: {
    title: "Contact Us | SAHASTRADEEP • SRC JDCOEM",
    description: "Connect with SRC JDCOEM for partnerships, club activities, event inquiries, and official communications.",
    url: "https://www.srcjdcoem.in/contact",
    siteName: "Sahastradeep - SRC JDCOEM",
    images: DEFAULT_OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Us | SAHASTRADEEP • SRC JDCOEM",
    description: "Connect with SRC JDCOEM for partnerships, club activities, event inquiries, and official communications.",
    images: DEFAULT_TWITTER_IMAGES,
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
