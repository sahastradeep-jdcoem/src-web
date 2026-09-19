import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the Student Representative Council (SRC) of JDCOEM Nagpur for queries, club collaborations, sponsorship, or grievance submissions.",
  openGraph: {
    title: "Contact Us | SAHASTRADEEP • SRC JDCOEM",
    description: "Connect with SRC JDCOEM for partnerships, club activities, event inquiries, and official communications.",
    url: "https://srcjdcoem.in/contact",
    siteName: "Sahastradeep - SRC JDCOEM",
  },
  twitter: {
    card: "summary",
    title: "Contact Us | SAHASTRADEEP • SRC JDCOEM",
    description: "Connect with SRC JDCOEM for partnerships, club activities, event inquiries, and official communications.",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
