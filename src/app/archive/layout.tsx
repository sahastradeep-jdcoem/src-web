import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Archive",
  description: "Explore historical records, past tenures, legacy leadership rosters, and achievements of the Student Representative Council at JDCOEM Nagpur.",
  openGraph: {
    title: "Archive | SAHASTRADEEP • SRC JDCOEM",
    description: "Historical records, previous tenures, and past council rosters of SRC JDCOEM Nagpur.",
    url: "https://srcjdcoem.in/archive",
    siteName: "Sahastradeep - SRC JDCOEM",
  },
  twitter: {
    card: "summary",
    title: "Archive | SAHASTRADEEP • SRC JDCOEM",
    description: "Historical records, previous tenures, and past council rosters of SRC JDCOEM Nagpur.",
  },
};

export default function ArchiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
