import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AuthProvider } from "@/context/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { ProfileSetupModal } from "@/components/auth/ProfileSetupModal";
import { ToastContainer } from "@/components/ui/Toast";
import SEOStructuredData from "@/components/seo/SEOStructuredData";
import { SocialShareProvider } from "@/context/SocialShareContext";

export const viewport: Viewport = {
  themeColor: "#17458F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.srcjdcoem.in"),
  alternates: {
    canonical: "https://www.srcjdcoem.in",
  },
  title: {
    default: "Sahastradeep - SRC JDCOEM | Student Representative Council • JDCOEM",
    template: "%s | Sahastradeep - SRC JDCOEM",
  },
  description: "Official digital platform of the Student Representative Council (SRC) of JD College of Engineering & Management, Nagpur. Uniting 12 clubs, flagship fests, and student leadership.",
  manifest: "/manifest.json",
  icons: {
    icon: "/assets/SRC Logo.png",
    apple: "/assets/SRC Logo.png",
  },
  openGraph: {
    title: "Sahastradeep - SRC JDCOEM",
    description: "Official Student Representative Council portal of JDCOEM Nagpur. Flagship fests, 12 club charters, and student accreditation.",
    url: "https://www.srcjdcoem.in",
    siteName: "Sahastradeep - SRC JDCOEM",
    images: [
      {
        url: "/assets/SRC Logo.png",
        width: 800,
        height: 800,
        alt: "SRC JDCOEM Official Seal",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sahastradeep - SRC JDCOEM",
    description: "Official Student Representative Council portal of JDCOEM Nagpur. Flagship fests, 12 club charters, and student accreditation.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&family=Sora:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans flex flex-col justify-between selection:bg-[#E78023] selection:text-white">
        <Suspense fallback={null}>
          <SEOStructuredData />
        </Suspense>
        <AuthProvider>
          <SocialShareProvider>
            <Navbar />
            <main className="flex-grow pt-16 w-full min-w-0 overflow-x-clip">
              {children}
            </main>
            <Footer />
            <AuthModal />
            <ProfileSetupModal />
            <ToastContainer />
          </SocialShareProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
