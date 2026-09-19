import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clubs",
  description: "Explore 12 chartered student clubs under the Student Representative Council at JDCOEM Nagpur — technical, cultural, sports, and creative societies.",
  openGraph: {
    title: "Clubs | SAHASTRADEEP • SRC JDCOEM",
    description: "Discover 12 student clubs under SRC JDCOEM Nagpur — from coding and robotics to dance, music, and drama.",
    url: "https://srcjdcoem.in/clubs",
    siteName: "SAHASTRADEEP — SRC JDCOEM",
  },
  twitter: {
    card: "summary",
    title: "Clubs | SAHASTRADEEP • SRC JDCOEM",
    description: "Discover 12 student clubs under SRC JDCOEM Nagpur.",
  },
};

export default function ClubsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
