import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prarambh — Central Induction",
  description: "Official orientation and central induction program for first-year inductees, organized by the Student Representative Council (SRC) at JDCOEM Nagpur.",
  alternates: {
    canonical: "https://www.srcjdcoem.in/prarambh",
  },
  openGraph: {
    title: "Prarambh — Central Induction | SAHASTRADEEP • SRC JDCOEM",
    description: "Welcome to JDCOEM. Explore Prarambh induction schedule, club showcases, campus mentors, and onboarding details.",
    url: "https://www.srcjdcoem.in/prarambh",
    siteName: "Sahastradeep - SRC JDCOEM",
  },
  twitter: {
    card: "summary",
    title: "Prarambh — Central Induction | SAHASTRADEEP • SRC JDCOEM",
    description: "Welcome to JDCOEM. Explore Prarambh induction schedule, club showcases, and onboarding details.",
  },
};

export default function PrarambhLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
