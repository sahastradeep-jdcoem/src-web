import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { 
  ShieldCheck, 
  Lock, 
  EyeOff, 
  Database, 
  UserCheck, 
  Clock, 
  MapPin, 
  Mail,
  ChevronRight,
  KeyRound,
  FileCheck2
} from "lucide-react";
import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/data/seoMetadata";

export const metadata: Metadata = {
  title: "Privacy Policy | SAHASTRADEEP • SRC JDCOEM",
  description: "Official Privacy Policy of the Student Representative Council (SRC) at JD College of Engineering & Management, Nagpur. Learn how student data is protected and secured.",
  alternates: {
    canonical: "https://www.srcjdcoem.in/privacy",
  },
  openGraph: {
    title: "Privacy Policy | SAHASTRADEEP • SRC JDCOEM",
    description: "Official data privacy, student confidentiality, and digital security policy of the Student Representative Council of JDCOEM Nagpur.",
    url: "https://www.srcjdcoem.in/privacy",
    siteName: "Sahastradeep - SRC JDCOEM",
    images: DEFAULT_OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | SAHASTRADEEP • SRC JDCOEM",
    description: "Official data privacy, student confidentiality, and digital security policy of the Student Representative Council of JDCOEM Nagpur.",
    images: DEFAULT_TWITTER_IMAGES,
  },
};

export default function PrivacyPage() {
  const lastUpdated = "October 1, 2026";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8 space-y-16">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header Hero */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-xs font-bold text-emerald-800 uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Data Protection &amp; Confidentiality</span>
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[#17458F] uppercase tracking-tight">
            PRIVACY POLICY
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed font-medium">
            Student Representative Council (SRC) • JD College of Engineering &amp; Management, Nagpur
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>Effective / Last Updated: {lastUpdated}</span>
          </div>
        </div>

        {/* Content Box */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 lg:p-12 shadow-sm space-y-10 text-slate-700 text-sm leading-relaxed">
          
          {/* Section 1: Overview */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">1.</span>
              <span>Commitment to Student Privacy</span>
            </h2>
            <p>
              The <strong>Student Representative Council (SRC) — Sahastradeep</strong> of <strong>JD College of Engineering &amp; Management (JDCOEM), Nagpur</strong> operates the official portal at <Link href="/" className="text-[#17458F] font-semibold hover:underline">www.srcjdcoem.in</Link>. We are committed to safeguarding the privacy and digital security of our students, faculty members, and external collegiate delegates.
            </p>
            <p>
              This Privacy Policy explains how we collect, handle, store, and protect your personal information in compliance with the <strong>Information Technology Act, 2000</strong>, the <strong>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011</strong>, and applicable Indian data protection standards.
            </p>
          </section>

          {/* Section 2: Data We Collect */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">2.</span>
              <span>Information We Collect</span>
            </h2>
            <p>
              We collect only the minimum necessary information required to facilitate event participation and student governance:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>
                <strong>Academic Identity Details:</strong> Full Name, College Roll / BT ID, Academic Department, Year of Study, and College/Institution Name (for external collegiate delegates).
              </li>
              <li>
                <strong>Contact Information:</strong> Official/Personal Email Address and Mobile Number (used strictly for festival pass delivery, gate check-in alerts, and emergency team communication).
              </li>
              <li>
                <strong>Team Information:</strong> For group competitions, Team Name, Member Rosters, and assigned Team Lead details.
              </li>
              <li>
                <strong>Transaction References:</strong> Order ID, Timestamp, and 12-digit UPI Bank Reference Number (UTR) submitted for manual or automated fee verification.
              </li>
            </ul>
          </section>

          {/* Section 3: Financial & Payment Security (Crucial for Gateway Audits) */}
          <section className="space-y-3 p-5 rounded-2xl bg-blue-50/60 border border-blue-200/80">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#17458F] uppercase flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>3. Payment Card &amp; Financial Security Guarantee</span>
            </h2>
            <p className="font-medium text-slate-800">
              SRC JDCOEM does NOT collect, capture, store, or process any payment card details or banking passwords on our servers:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700 text-xs sm:text-sm">
              <li>We do <strong>NOT</strong> store Credit/Debit card numbers, CVVs, expiry dates, or Net Banking credentials.</li>
              <li>We do <strong>NOT</strong> have access to or store your UPI MPIN or personal banking security PINs.</li>
              <li>All online payment transactions are processed through <strong>RBI-licensed Payment Aggregators</strong> (e.g. Cashfree Payments, Easebuzz, Paytm) via bank-grade <strong>256-bit SSL/TLS encrypted</strong> channels.</li>
            </ul>
          </section>

          {/* Section 4: How We Use the Data */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">4.</span>
              <span>How We Use Your Information</span>
            </h2>
            <p>
              Your data is utilized strictly for non-commercial, collegiate operational functions:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>Generating digital QR entry passes and verifying gate admissions at campus security checkpoints.</li>
              <li>Orchestrating competition fixtures, judge scoring brackets, and certificate issuance.</li>
              <li>Sending important event updates, schedule shifts, or weather alerts via email or SMS.</li>
              <li>Facilitating student council voting, polling, and leadership applications.</li>
            </ul>
          </section>

          {/* Section 5: Zero Selling to Third Parties */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">5.</span>
              <span>No Sale or Commercial Renting of Student Data</span>
            </h2>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium">
              We pledge that student personal data is <strong>never sold, traded, rented, or leased</strong> to third-party telemarketers, commercial advertisers, or external marketing agencies.
            </div>
            <p>
              Information is accessible strictly to authorized faculty coordinators and designated SRC executive committee members on a strict need-to-know basis.
            </p>
          </section>

          {/* Section 6: Data Retention & Storage */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">6.</span>
              <span>Data Retention &amp; Security Measures</span>
            </h2>
            <p>
              All registration data is stored in enterprise-tier, ISO 27001-certified cloud infrastructure (Google Cloud Platform / Firebase Firestore) equipped with strict role-based access control (RBAC), multi-factor authentication for administrators, and continuous security auditing. Data is retained for the duration of the academic tenure for certificate validation and institutional archiving.
            </p>
          </section>

          {/* Section 7: Student Rights */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">7.</span>
              <span>Your Rights</span>
            </h2>
            <p>
              Registered students and delegates have the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>Review and access their active registration pass records in the <Link href="/dashboard" className="text-[#17458F] font-semibold hover:underline">Student Dashboard</Link>.</li>
              <li>Request corrections to misspelled personal details or wrong contact information before event commencement.</li>
              <li>Request the complete deletion of their test accounts or non-active historical registrations by contacting the secretariat.</li>
            </ul>
          </section>

          {/* Section 8: Grievance Officer */}
          <section className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">8.</span>
              <span>Grievance Officer &amp; Contact</span>
            </h2>
            <p>
              In accordance with the Information Technology Act, 2000 and rules made thereunder, any concerns or complaints regarding data privacy should be addressed to the Student Representative Council Secretariat:
            </p>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
              <p className="font-bold text-slate-900">Student Representative Council (Sahastradeep)</p>
              <p className="text-slate-600">Attention: Data Privacy &amp; Council Secretariat</p>
              <p className="text-slate-600">JD College of Engineering &amp; Management</p>
              <p className="text-slate-600">Katol Road, Nagpur, Maharashtra — 441501, India</p>
              <p className="text-[#17458F] font-semibold pt-1">
                Official Email: <a href="mailto:srcjdcoem@gmail.com" className="hover:underline">srcjdcoem@gmail.com</a>
              </p>
            </div>
          </section>

        </div>

        {/* Quick Links strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 text-xs">
          <span className="text-slate-500 font-medium">Related Legal Charters:</span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-[#17458F] font-bold hover:underline flex items-center gap-1">
              <span>Terms &amp; Conditions</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <Link href="/refund-policy" className="text-[#17458F] font-bold hover:underline flex items-center gap-1">
              <span>Refund Policy</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <Link href="/contact" className="text-[#17458F] font-bold hover:underline flex items-center gap-1">
              <span>Contact Secretariat</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
