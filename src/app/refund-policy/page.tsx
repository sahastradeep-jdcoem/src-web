import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { 
  RotateCcw, 
  ShieldCheck, 
  AlertCircle, 
  Clock, 
  MapPin, 
  Mail, 
  CheckCircle2, 
  HelpCircle,
  ChevronRight,
  IndianRupee,
  CalendarCheck
} from "lucide-react";
import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/data/seoMetadata";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy | SAHASTRADEEP • SRC JDCOEM",
  description: "Official delegate refund, cancellation timeframe, and ticketing reversal guidelines of the Student Representative Council (SRC) at JD College of Engineering & Management, Nagpur.",
  alternates: {
    canonical: "https://www.srcjdcoem.in/refund-policy",
  },
  openGraph: {
    title: "Cancellation & Refund Policy | SAHASTRADEEP • SRC JDCOEM",
    description: "Clear, transparent delegate pass cancellation rules and refund processing timelines for collegiate events and festivals at JDCOEM Nagpur.",
    url: "https://www.srcjdcoem.in/refund-policy",
    siteName: "Sahastradeep - SRC JDCOEM",
    images: DEFAULT_OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "Cancellation & Refund Policy | SAHASTRADEEP • SRC JDCOEM",
    description: "Clear, transparent delegate pass cancellation rules and refund processing timelines for collegiate events and festivals at JDCOEM Nagpur.",
    images: DEFAULT_TWITTER_IMAGES,
  },
};

export default function RefundPolicyPage() {
  const lastUpdated = "October 1, 2026";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8 space-y-16">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header Hero */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-50 border border-purple-200/80 text-xs font-bold text-purple-900 uppercase tracking-wider">
            <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
            <span>Fair Entry &amp; Transparent Reversals</span>
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[#17458F] uppercase tracking-tight">
            CANCELLATION &amp; REFUND POLICY
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
              <span>Overview &amp; Fair Entry Commitment</span>
            </h2>
            <p>
              At <strong>SAHASTRADEEP — Student Representative Council (SRC)</strong> of <strong>JD College of Engineering &amp; Management (JDCOEM), Nagpur</strong>, we are committed to complete transparency, fairness, and student convenience in all ticketing, festival entry, and delegate pass operations.
            </p>
            <p>
              We recognize that unforeseen academic conflicts, medical emergencies, or schedule adjustments may require a participant to request a cancellation, or may compel the council to reschedule an event. This policy outlines the exact procedures, conditions, and processing timelines for ticket cancellations and refunds.
            </p>
          </section>

          {/* Section 2: Golden Rule Timeframe (Highlight Box for Payment Gateway Auditors) */}
          <section className="p-6 rounded-3xl bg-gradient-to-br from-emerald-50 via-teal-50/40 to-blue-50/60 border border-emerald-200 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-950 font-bold uppercase tracking-wider text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Mandatory Gateway Compliance Guarantee</span>
            </div>
            <h3 className="font-heading font-extrabold text-xl sm:text-2xl text-slate-900">
              5 to 7 Working Days Refund Settlement
            </h3>
            <p className="text-slate-700 leading-relaxed text-xs sm:text-sm font-medium">
              Upon approval of an eligible refund request or event cancellation, the full refund amount will be initiated through our authorized payment gateway (Cashfree / Easebuzz / Paytm) and credited back directly to the participant&apos;s <strong>original payment source (UPI VPA / Bank Account / Card)</strong> within <strong>5 to 7 business days</strong>.
            </p>
          </section>

          {/* Section 3: Event Cancellation by Council */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">2.</span>
              <span>Event Cancellation or Postponement by SRC JDCOEM</span>
            </h2>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  <strong>100% Full Refund on Cancellation:</strong> If an event, competition, or festival is cancelled by the college administration or SRC JDCOEM due to unavoidable weather disruptions, university exam rescheduling, or technical reasons, registered delegates will receive a <strong>100% automatic refund</strong> of their registration fee.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Rescheduled Events:</strong> If an event is postponed to a future date, your delegate pass remains automatically valid for the rescheduled date. If a registered participant cannot attend the revised schedule, they may claim a full refund within 48 hours of the rescheduling announcement.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Participant-Initiated Cancellation */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">3.</span>
              <span>Participant-Initiated Cancellation Window</span>
            </h2>
            <p>
              Students who have registered for a paid event but are unable to attend may request a pass cancellation under the following conditions:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>
                <strong>Notice Period:</strong> Cancellation requests must be submitted at least <strong>24 to 48 hours prior</strong> to the scheduled commencement date and time of the event.
              </li>
              <li>
                <strong>Valid Reasons:</strong> Medical emergencies, official university semester exams, or unavoidable personal circumstances.
              </li>
              <li>
                <strong>Pass Invalidation:</strong> Once a refund request is approved, the associated digital QR entry pass will be marked as <code className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-mono text-xs">REFUNDED</code> in the council database and will be rendered void at entrance check-in gates.
              </li>
            </ul>
          </section>

          {/* Section 5: Non-Refundable Scenarios */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">4.</span>
              <span>Non-Refundable Circumstances</span>
            </h2>
            <p>Refunds shall NOT be issued under the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
              <li><strong>No-Shows:</strong> Failure to attend the event on the designated date without prior written cancellation notice.</li>
              <li><strong>Post-Event Requests:</strong> Any refund request submitted after the event has already concluded.</li>
              <li><strong>Disqualification:</strong> Delegates disqualified or expelled by event judges, faculty patrons, or campus security due to code of conduct violations, indiscipline, or falsified eligibility credentials.</li>
              <li><strong>Free Events:</strong> Events marked with &quot;Free Entry&quot; have no financial liability.</li>
            </ul>
          </section>

          {/* Section 6: How to Request a Refund */}
          <section className="space-y-3">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">5.</span>
              <span>How to Request a Refund</span>
            </h2>
            <p>To request a refund, follow these simple steps:</p>
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#17458F] text-white flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
                <p className="text-slate-700">Send an email to <a href="mailto:srcjdcoem@gmail.com" className="text-[#17458F] font-bold hover:underline">srcjdcoem@gmail.com</a> with the subject: <strong>&quot;Refund Request - [Your Order ID]&quot;</strong>.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#17458F] text-white flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
                <p className="text-slate-700">Include your <strong>Full Name</strong>, <strong>Registered Phone Number</strong>, <strong>Event Name</strong>, and <strong>12-digit UTR/Bank Reference</strong>.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#17458F] text-white flex items-center justify-center font-bold text-[11px] shrink-0">3</span>
                <p className="text-slate-700">Our Treasury team will verify the payment against the institutional ledger within <strong>24 business hours</strong> and notify you via email when the refund is released.</p>
              </div>
            </div>
          </section>

          {/* Section 7: Dispute Resolution */}
          <section className="space-y-3 pt-6 border-t border-slate-100">
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#0F172A] uppercase flex items-center gap-2">
              <span className="text-[#E78023]">6.</span>
              <span>Treasury Helpdesk &amp; Support Contact</span>
            </h2>
            <p>
              For unresolved refund inquiries, double-debit escalations, or payment assistance, contact the Student Representative Council Treasury:
            </p>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
              <p className="font-bold text-slate-900">SRC Payments &amp; Treasury Secretariat</p>
              <p className="text-slate-600">JD College of Engineering &amp; Management</p>
              <p className="text-slate-600">Katol Road, Nagpur, Maharashtra — 441501, India</p>
              <p className="text-[#17458F] font-semibold pt-1">
                Official Treasury Email: <a href="mailto:srcjdcoem@gmail.com" className="hover:underline">srcjdcoem@gmail.com</a>
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
            <Link href="/privacy" className="text-[#17458F] font-bold hover:underline flex items-center gap-1">
              <span>Privacy Policy</span>
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
