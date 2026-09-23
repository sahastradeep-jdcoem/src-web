import type { Metadata } from "next";

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
  },
  twitter: {
    card: "summary",
    title: "Hub | SAHASTRADEEP • SRC JDCOEM",
    description: "Explore opportunities, campus polls, applications, contests, and student support on the SRC JDCOEM Student Engagement Hub.",
  },
};

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
