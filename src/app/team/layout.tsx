import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our Team",
  description: "Meet the Student Representative Council leadership team at JDCOEM Nagpur — President, Vice President, Mentor, and all council members.",
  openGraph: {
    title: "Our Team | SAHASTRADEEP • SRC JDCOEM",
    description: "Meet the elected student leaders and council members of SRC JDCOEM Nagpur.",
    url: "https://srcjdcoem.in/team",
    siteName: "SAHASTRADEEP — SRC JDCOEM",
  },
  twitter: {
    card: "summary",
    title: "Our Team | SAHASTRADEEP • SRC JDCOEM",
    description: "Meet the elected student leaders and council members of SRC JDCOEM Nagpur.",
  },
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
