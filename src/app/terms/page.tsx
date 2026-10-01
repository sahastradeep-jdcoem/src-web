import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { 
  FileText, 
  ShieldCheck, 
  Scale, 
  Users, 
  AlertCircle, 
  Clock, 
  MapPin, 
  Mail,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/data/seoMetadata";

export const metadata: Metadata = {
  title: "Terms & Conditions | SAHASTRADEEP • SRC JDCOEM",
  description: "Official terms and conditions, delegate entry policies, and student participation guidelines of the Student Representative Council (SRC) at JD College of Engineering & Management, Nagpur.",
  alternates: {
    canonical: "https://www.srcjdcoem.in/terms",
  },
  openGraph: {
    title: "Terms & Conditions | SAHASTRADEEP • SRC JDCOEM",
    description: "Official terms of service and delegate participation charter for collegiate events and festivals at JDCOEM Nagpur.",
    url: "https://www.srcjdcoem.in/terms",
    siteName: "Sahastradeep - SRC JDCOEM",
    images: DEFAULT_OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms & Conditions | SAHASTRADEEP • SRC JDCOEM",
    description: "Official terms of service and delegate participation charter for collegiate events and festivals at JDCOEM Nagpur.",
    images: DEFAULT_TWITTER_IMAGES,
  },
};

export default function TermsPage() {
  const lastUpdated = "October 1, 2026";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8 space-y-16">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header Hero */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-xs font-bold text-[#17458F] uppercase tracking-wider">
            <Scale className="w-3.5 h-3.5 text-[#E78023]" />
            <span>Institutional Governance</span>
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[#17458F] uppercase tracking-tight">
            TERMS &amp; CONDITIONS
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
              <span>Acceptance of Terms</span>
            </h2>
            <p>
              Welcome to the official web portal of the <strong>Student Representative Council (SRC) — Sahastradeep</strong>, the apex student governance body of <strong>JD College of Engineering &amp; Management (JDCOEM), Nagpur</strong> (accessible at <Link href="/" className="text-[#17458F] font-semibold hover:underline">www.srcjdcoem.in</Link>).
            </p>
            <p>
              By accessing our website, creating an account, registering for events, festivals, or workshops, or purchasing delegate passes, you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions, our <Link href="/privacy" className="text-[#17458F] font-semibold hover:underline">Privacy Policy</Link>, and our <Link href="/refund-policy" className="text-[#17458F] font-semibold hover:underline">Cancellation &amp; Refund Policy</Link>.
            </p>
          </section>

          {/* Section 2: Services Provided */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">2.</span>
              <span>Collegiate Services &amp; Event Operations</span>
            </h2>
            <p>
              SRC JDCOEM provides an institutional digital platform that facilitates:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li>Registration and ticketing for collegiate festivals, cultural competitions, hackathons, and sports tournaments.</li>
              <li>Issuance of digital scannable QR delegate passes for campus gate access.</li>
              <li>Coordination of 12 chartered student clubs and departmental academic associations.</li>
              <li>Dissemination of official council circulars, election guidelines, and student grievance submissions.</li>
            </ul>
          </section>

          {/* Section 3: Eligibility & Student Credentials */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">3.</span>
              <span>Registration &amp; Eligibility</span>
            </h2>
            <p>
              Participation in campus events is governed by category-specific eligibility:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li><strong>JDCOEM Students:</strong> Must provide authentic student credentials including registered College BT ID, Department, and Academic Year.</li>
              <li><strong>External Inter-College Delegates:</strong> For inter-collegiate festivals, external participants must present a valid college identity card from their recognized university/institution at the campus entrance.</li>
              <li><strong>Accuracy of Information:</strong> You agree to provide true, accurate, and current details during registration. Providing fraudulent identities or falsified payment reference numbers (UTRs) will result in immediate disqualification and campus security reporting.</li>
            </ul>
          </section>

          {/* Section 4: Pass Protocols & Non-Transferability */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">4.</span>
              <span>Delegate Passes &amp; Access Controls</span>
            </h2>
            <p>
              Upon successful registration and fee verification, a unique digital <strong>QR Delegate Pass</strong> is issued to the participant:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li><strong>Non-Transferable:</strong> Passes are issued strictly to the registered participant/team and cannot be sold, bartered, or transferred to another individual.</li>
              <li><strong>Gate Check-in:</strong> Passes must be displayed on a mobile device or physical printout at official campus entry points. Passes will be validated via the council&apos;s real-time verification system.</li>
              <li><strong>Right of Admission:</strong> The college administration and SRC volunteer security reserve the right to deny admission if the pass holder fails to produce a matching college ID or breaches campus conduct rules.</li>
            </ul>
          </section>

          {/* Section 5: Code of Conduct & Anti-Ragging */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">5.</span>
              <span>Campus Code of Conduct</span>
            </h2>
            <p>
              All delegates attending events on the JDCOEM campus must strictly adhere to university disciplinary standards:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li><strong>Zero Tolerance for Ragging:</strong> In accordance with UGC and AICTE regulations, any act of harassment, ragging, or intimidation is strictly prohibited and subject to immediate police reporting.</li>
              <li><strong>Campus Integrity:</strong> Vandalism, consumption of alcohol, narcotics, or tobacco products, and possession of hazardous materials on college premises are strictly forbidden.</li>
              <li><strong>Volunteer Cooperation:</strong> Participants must follow instructions given by event coordinators, student volunteers, and faculty patrons.</li>
            </ul>
          </section>

          {/* Section 6: Payment & Fees */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">6.</span>
              <span>Pricing, Payments &amp; Settlement</span>
            </h2>
            <p>
              All registration fees for workshops, fests, or sports categories are transparently listed in Indian Rupees (₹) on the respective event page with zero hidden convenience fees.
            </p>
            <p>
              Payments are processed through authorized payment aggregators via UPI, Net Banking, and Debit/Credit Cards. SRC JDCOEM does not store sensitive card or bank authorization credentials. Refer to our <Link href="/refund-policy" className="text-[#17458F] font-semibold hover:underline">Cancellation &amp; Refund Policy</Link> for detailed refund timelines.
            </p>
          </section>

          {/* Section 7: Media & Intellectual Property */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">7.</span>
              <span>Photography &amp; Media Release</span>
            </h2>
            <p>
              By participating in public campus festivals organized by SRC JDCOEM, you consent to being photographed, recorded, and featured in official council recap videos, photo galleries, social media posts, and university publications for non-commercial institutional archiving.
            </p>
          </section>

          {/* Section 8: Governing Law */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">8.</span>
              <span>Governing Law &amp; Jurisdiction</span>
            </h2>
            <p>
              These Terms and Conditions shall be governed by and construed in accordance with the laws of the Republic of India. Any disputes arising out of or in connection with the platform or event participation shall be subject to the exclusive jurisdiction of the competent courts in <strong>Nagpur, Maharashtra</strong>.
            </p>
          </section>

          {/* Section 9: Contact Secretariat */}
          <section className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">9.</span>
              <span>Contact Secretariat</span>
            </h2>
            <p>
              For legal inquiries, clarification on these terms, or administrative support, reach out to the council secretariat:
            </p>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
              <p className="font-bold text-slate-900">Student Representative Council (Sahastradeep)</p>
              <p className="text-slate-600">JD College of Engineering &amp; Management</p>
              <p className="text-slate-600">Katol Road, Nagpur, Maharashtra — 441501, India</p>
              <p className="text-[#17458F] font-semibold pt-1">
                Email: <a href="mailto:srcjdcoem@gmail.com" className="hover:underline">srcjdcoem@gmail.com</a>
              </p>
            </div>
          </section>

        </div>

        {/* Quick Links strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 text-xs">
          <span className="text-slate-500 font-medium">Related Legal Charters:</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-[#17458F] font-bold hover:underline flex items-center gap-1">
              <span>Privacy Policy</span>
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
