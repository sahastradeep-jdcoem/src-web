import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  UserCheck, 
  Users, 
  QrCode, 
  GraduationCap, 
  HelpCircle, 
  ArrowRight, 
  Sparkles, 
  Smartphone, 
  LogOut, 
  FileCheck, 
  Ticket, 
  CreditCard, 
  MessageCircle, 
  AlertTriangle,
  Info,
  Clock,
  Layers,
  Search,
  School,
  Lock,
  ChevronRight,
  ExternalLink,
  Play,
  Download
} from "lucide-react";
import { Accordion } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { DEFAULT_OG_IMAGES, DEFAULT_TWITTER_IMAGES } from "@/data/seoMetadata";

export const metadata: Metadata = {
  title: "Registration & Account Guide | SAHASTRADEEP • SRC JDCOEM",
  description: "Official student tutorial and guidelines for portal account setup, event registration, team management, and avoiding proxy registration issues at JDCOEM Nagpur.",
  alternates: {
    canonical: "https://www.srcjdcoem.in/how-to-register",
  },
  openGraph: {
    title: "Registration & Account Guide | SAHASTRADEEP • SRC JDCOEM",
    description: "Step-by-step student tutorial for account creation, ticket passes, team entries, and proxy registration rules.",
    url: "https://www.srcjdcoem.in/how-to-register",
    siteName: "Sahastradeep - SRC JDCOEM",
    images: DEFAULT_OG_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "Registration & Account Guide | SAHASTRADEEP • SRC JDCOEM",
    description: "Step-by-step student tutorial for account creation, ticket passes, team entries, and proxy registration rules.",
    images: DEFAULT_TWITTER_IMAGES,
  },
};

const FAQ_ITEMS = [
  {
    id: "faq-friend-mistake",
    title: "I accidentally registered my friend using my own account! How do I fix this?",
    content: (
      <div className="space-y-3">
        <p>
          Because the ticket was created under your account, the system considers <strong>you</strong> as registered for that event. To fix this:
        </p>
        <ol className="list-decimal pl-5 space-y-1.5 text-xs sm:text-sm">
          <li>
            Go to your <Link href="/dashboard" className="text-[#17458F] font-bold hover:underline">Student Dashboard</Link> and find the registration card for that event.
          </li>
          <li>
            If the event allows cancellation before the deadline, tap <strong>Cancel Registration</strong> to release the slot and clear your account.
          </li>
          <li>
            If cancellation is unavailable or the event was paid, immediately reach out to the <strong>SRC Technical Desk</strong> via the <Link href="/contact" className="text-[#17458F] font-bold hover:underline">Help &amp; Grievances Portal</Link> or official WhatsApp support with your <strong>Registration Pass ID</strong>.
          </li>
          <li>
            After the cancellation is completed, your friend must sign into their <strong>own</strong> account to register properly.
          </li>
        </ol>
      </div>
    ),
  },
  {
    id: "faq-btid-in-use",
    title: "Why does it say 'BT ID already registered or taken by another account'?",
    content: (
      <div className="space-y-3">
        <p>
          Each official JDCOEM BT ID (e.g. <code>BT210036CS</code>) can be linked to <strong>only one Google account</strong> for institutional integrity.
        </p>
        <p>
          If you encounter this error, it usually means you previously signed in with a different email address (for instance, your personal Gmail instead of your college Gmail, or vice versa).
        </p>
        <p className="text-xs sm:text-sm">
          <strong>Solution:</strong> Log out and sign in using the Google account you initially used when first entering your BT ID. If you cannot remember the linked account or believe someone else entered your BT ID in error, contact the SRC Secretariat at <a href="mailto:srcjdcoem@gmail.com" className="text-[#17458F] font-bold hover:underline">srcjdcoem@gmail.com</a> with a photo of your College ID card for instant verification.
        </p>
      </div>
    ),
  },
  {
    id: "faq-shared-phone",
    title: "Can I register multiple friends or classmates using my smartphone?",
    content: (
      <div className="space-y-3">
        <p>
          <strong>Yes, absolutely!</strong> But you must never do it while remaining logged into your own account.
        </p>
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm space-y-2">
          <p className="font-bold text-slate-800">Follow this simple 3-step cycle:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Open the menu and tap <strong>Sign Out / Logout</strong>.</li>
            <li>Hand the phone to your friend and let them tap <strong>Sign In with Google</strong> using their own Gmail/College account.</li>
            <li>Complete their event registration, download their QR pass to their device/drive, and then <strong>Sign Out</strong> so the next friend can register.</li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: "faq-team-registration",
    title: "How does Team / Squad registration work? Do all teammates need to register?",
    content: (
      <div className="space-y-3">
        <p>
          For team events, <strong>ONLY THE TEAM LEADER</strong> registers the team.
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
          <li>The Team Leader goes to the event page, selects <strong>Squad / Team</strong> format in Step 2.</li>
          <li>The Leader gives the team a name, and adds teammates by typing their <strong>BT ID</strong> (for JDCOEM students) or name and college (for external participants).</li>
          <li>Teammates <strong>MUST NOT</strong> submit a separate individual registration for the same competition! Doing so will register them twice or cause duplicate conflict.</li>
          <li>The Team Pass with all squad member names will be generated for the Leader, who can share the pass with all teammates.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "faq-readonly-fields",
    title: "Why are my Name and BT ID locked and cannot be edited during registration?",
    content: (
      <p>
        To prevent identity spoofing, duplicate ticketing, and erroneous certificates, your name, BT ID, and department in Step 1 of the event registration wizard are automatically verified and locked to your authenticated profile. If your name has a typo, you can update it in your <Link href="/dashboard" className="text-[#17458F] font-bold hover:underline">Student Dashboard</Link> under <strong>Edit Profile</strong> before submitting the registration.
      </p>
    ),
  },
  {
    id: "faq-where-is-pass",
    title: "Where can I find and re-download my ticket pass after registering?",
    content: (
      <p>
        Your pass is permanently saved to the cloud! Simply log into your account, open the top navigation menu, and tap <Link href="/dashboard" className="text-[#17458F] font-bold hover:underline">Student Dashboard</Link>. Under the <strong>My Registered Events</strong> tab, you will find all your active passes. You can view the QR code, download high-resolution PNG passes to your phone gallery, or rejoin the official WhatsApp group at any time.
      </p>
    ),
  },
  {
    id: "faq-external-eligibility",
    title: "Can students from other colleges register for JDCOEM events?",
    content: (
      <p>
        Yes, for all events flagged as <strong>🌐 Inter-College Open</strong>! When signing up, choose the <strong>Other College / Visiting Delegate</strong> account type and enter your college name and city. For campus-exclusive events marked <strong>🎓 JDCOEM Only</strong>, registration is strictly restricted to enrolled students with valid JDCOEM BT IDs.
      </p>
    ),
  },
];

export default function HowToRegisterPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-10 px-4 sm:px-6 lg:px-8 space-y-14">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Breadcrumb / Top Ribbon */}
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-1.5">
            <Link href="/" className="hover:text-[#17458F] transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <Link href="/events" className="hover:text-[#17458F] transition-colors">Events</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[#17458F] font-bold">Registration &amp; Account Guide</span>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Updated for 2025–26</span>
          </span>
        </div>

        {/* HERO SECTION */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <Badge variant="orange" size="md">
            STUDENT PORTAL GUIDE
          </Badge>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-[#0F172A] uppercase tracking-tight leading-tight">
            Account Creation &amp; <br className="hidden sm:inline" />
            <span className="text-[#17458F]">Registration Guidelines</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-medium">
            Everything you need to know about setting up your official student profile, acquiring verified QR delegate passes, managing team entries, and avoiding common registration mistakes.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="#golden-rule"
              className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold hover:bg-rose-100 transition-colors flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Read Golden Rule: No Friend Proxy</span>
            </a>
            <a
              href="#account-creation"
              className="px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-[#17458F] text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#17458F]" />
              <span>Account Setup</span>
            </a>
            <a
              href="#event-registration"
              className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[#E78023] text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-1.5"
            >
              <Ticket className="w-3.5 h-3.5 text-[#E78023]" />
              <span>Event Registration</span>
            </a>
            <a
              href="#faqs"
              className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>FAQs &amp; Help</span>
            </a>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 9:16 VERTICAL VIDEO TUTORIAL CARD                                        */}
        {/* ========================================================================= */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-indigo-200 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[#17458F] text-[11px] font-bold uppercase tracking-wider">
                <Play className="w-3 h-3 text-[#E78023] fill-current" />
                <span>Vertical Reel / Shorts Format (9:16)</span>
              </div>
              <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-[#0F172A] uppercase">
                Watch 30-Second Quick Video Guide
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Optimized for mobile screens, Reels, and WhatsApp status sharing.
              </p>
            </div>
            <a
              href="/assets/tutorial-video-9-16.mp4"
              download="Sahastradeep-Registration-Tutorial-9-16.mp4"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-xs shrink-0 self-start sm:self-center cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download MP4 (6.6MB)</span>
            </a>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-2">
            {/* 9:16 Mobile Frame */}
            <div className="relative w-full max-w-[280px] sm:max-w-[320px] aspect-[9/16] rounded-[32px] overflow-hidden shadow-2xl border-4 border-slate-900 bg-black shrink-0">
              <video
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              >
                <source src="/assets/tutorial-video-9-16.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Video Takeaways */}
            <div className="space-y-4 max-w-md text-xs sm:text-sm text-slate-600 font-medium">
              <h3 className="font-heading font-bold text-base text-slate-900 uppercase">
                What&apos;s Covered in This Video:
              </h3>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <span className="h-5 w-5 rounded-md bg-rose-100 text-rose-700 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">!</span>
                  <span><strong>The #1 Mistake:</strong> Never register for a friend through your own account.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-5 w-5 rounded-md bg-blue-100 text-[#17458F] font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
                  <span><strong>Account Creation:</strong> 1-click Google login, BT ID format, and verified badge.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-5 w-5 rounded-md bg-amber-100 text-[#E78023] font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
                  <span><strong>Solo vs Squad:</strong> How Team Leaders add teammates by BT ID in seconds.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-5 w-5 rounded-md bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
                  <span><strong>Saving Your Ticket:</strong> Download high-res pass to gallery and join WhatsApp.</span>
                </li>
              </ul>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
                📲 Council coordinators and CRs can forward this 9:16 video on class WhatsApp groups so every student knows the correct registration flow.
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 1: THE CRITICAL GOLDEN RULE — DO NOT REGISTER FOR FRIENDS         */}
        {/* ========================================================================= */}
        <section id="golden-rule" className="scroll-mt-24">
          <div className="rounded-3xl bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-white border-2 border-rose-400 p-6 sm:p-10 shadow-lg space-y-6">
            
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-rose-600 text-white">
                    CRITICAL WARNING
                  </span>
                  <span className="text-[11px] font-bold text-rose-700">
                    Most Common Student Mistake
                  </span>
                </div>
                <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-rose-950 uppercase tracking-tight">
                  Never Register for a Friend via Your Own Account!
                </h2>
                <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed pt-1">
                  On the Sahastradeep portal, <strong>1 Google Login = 1 Real Student</strong>. Every event ticket, barcode, roll number, and participation certificate is permanently tied to the account of the person who is logged in.
                </p>
              </div>
            </div>

            {/* Why This Causes Havoc */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white/90 border border-rose-200 shadow-xs space-y-2">
                <div className="h-8 w-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <XCircle className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                  1. Pass Stamped in YOUR Name
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed font-medium">
                  The system generates the QR pass with <strong>your</strong> name and BT ID. Your friend receives nothing on their phone and cannot be accredited at entry gates.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/90 border border-rose-200 shadow-xs space-y-2">
                <div className="h-8 w-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                  2. You Lock Yourself Out
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed font-medium">
                  Because you submitted the form, your profile is marked as <strong>Already Registered</strong>. When you later want to register yourself, you will be blocked!
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/90 border border-rose-200 shadow-xs space-y-2">
                <div className="h-8 w-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                  3. Certificates Invalidated
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed font-medium">
                  Attendance logs and digital certificates will carry your details instead of your friend&apos;s, leading to invalid academic records.
                </p>
              </div>
            </div>

            {/* The Right Way Box */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-heading font-extrabold text-sm sm:text-base text-[#17458F] uppercase flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>The Correct Way to Register:</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
                  <span className="font-extrabold text-xs uppercase tracking-wider text-[#17458F] block">
                    Scenario A • Solo / Individual Events
                  </span>
                  <p className="text-slate-700 leading-relaxed font-medium">
                    Every student <strong>must log in with their own Google account</strong> on their phone.
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                    <strong>Sharing a phone?</strong> Simply tap <span className="font-bold text-slate-700">Sign Out</span>. Then let your friend tap <span className="font-bold text-slate-700">Sign In</span> with their Google account, complete their registration, and sign out!
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                  <span className="font-extrabold text-xs uppercase tracking-wider text-[#E78023] block">
                    Scenario B • Team / Squad Events
                  </span>
                  <p className="text-slate-700 leading-relaxed font-medium">
                    Only <strong>ONE person (the Team Leader)</strong> registers for the team!
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                    The Leader chooses &quot;Squad / Team&quot; in Step 2 and adds friends by typing their <strong>BT ID</strong>. Teammates do NOT need to submit individual entries.
                  </p>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* DO'S AND DON'TS COMPARISON MATRIX                                        */}
        {/* ========================================================================= */}
        <section className="space-y-4">
          <div className="text-center space-y-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#E78023]">
              Quick Reference
            </span>
            <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-[#0F172A] uppercase">
              Student Dos &amp; Don&apos;ts
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* DO */}
            <div className="rounded-2xl bg-white border-2 border-emerald-400 p-5 sm:p-6 shadow-sm space-y-3.5">
              <div className="flex items-center gap-2 pb-2 border-b border-emerald-100">
                <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  ✓
                </div>
                <h3 className="font-heading font-bold text-emerald-900 text-base uppercase">
                  Always Do
                </h3>
              </div>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 font-medium">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Use your official <strong>@jdcoem.ac.in</strong> or active personal Google account.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Provide your official BT ID (e.g. <code>BT210036CS</code>) with zero spaces.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Enter your real First Name &amp; Last Name exactly as on college records.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Download your QR Ticket Pass directly to your phone gallery right after registering.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Tap the WhatsApp link on the confirmation pass to join the official event group.</span>
                </li>
              </ul>
            </div>

            {/* DON'T */}
            <div className="rounded-2xl bg-white border-2 border-rose-400 p-5 sm:p-6 shadow-sm space-y-3.5">
              <div className="flex items-center gap-2 pb-2 border-b border-rose-100">
                <div className="h-6 w-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">
                  ✕
                </div>
                <h3 className="font-heading font-bold text-rose-900 text-base uppercase">
                  Never Do
                </h3>
              </div>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 font-medium">
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span><strong>Do not register a friend using your account</strong> — it corrupts your tickets.</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>Do not change your own profile BT ID or name to your friend&apos;s credentials.</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>Do not use nicknames, emojis, or lowercase casual names in profile fields.</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>Do not register individually if your Team Leader already registered your squad.</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>Do not share or forward your QR ticket code to others; each code is scanned once.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: ACCOUNT CREATION TUTORIAL                                      */}
        {/* ========================================================================= */}
        <section id="account-creation" className="scroll-mt-24 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
              Tutorial Part 01
            </span>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase mt-1">
              Step-by-Step Account Setup
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Takes less than 45 seconds to get your verified student identity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Step 1 */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="h-8 w-8 rounded-xl bg-blue-100 text-[#17458F] font-bold text-xs flex items-center justify-center font-heading">
                  01
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Authentication
                </span>
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900">
                1-Click Google Sign-In
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Tap <strong>Sign In</strong> at the top right of any page. Authenticate with your Google account (College ID or personal email). No passwords to memorize.
              </p>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
                💡 Tip: Use your primary smartphone browser so your Google account stays logged in for quick fest check-ins.
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="h-8 w-8 rounded-xl bg-amber-100 text-[#E78023] font-bold text-xs flex items-center justify-center font-heading">
                  02
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Role Classification
                </span>
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900">
                Select Your Role Correctly
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Choose from the three institutional categories:
              </p>
              <ul className="text-xs text-slate-600 space-y-1.5 font-medium">
                <li className="flex items-center gap-2">
                  <GraduationCap className="w-3.5 h-3.5 text-[#17458F]" />
                  <span><strong>JDCOEM Student</strong>: For enrolled students with an official BT ID.</span>
                </li>
                <li className="flex items-center gap-2">
                  <School className="w-3.5 h-3.5 text-[#E78023]" />
                  <span><strong>Faculty &amp; Staff</strong>: For college professors and department coordinators.</span>
                </li>
                <li className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                  <span><strong>Other College Delegate</strong>: For visiting students from external institutions.</span>
                </li>
              </ul>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="h-8 w-8 rounded-xl bg-blue-100 text-[#17458F] font-bold text-xs flex items-center justify-center font-heading">
                  03
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Profile Details
                </span>
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900">
                Fill Real Academic Information
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Enter your details accurately:
              </p>
              <ul className="text-xs text-slate-600 space-y-1.5 font-medium">
                <li>• <strong>First &amp; Last Name</strong>: Official name for participation certificates.</li>
                <li>• <strong>10-Digit WhatsApp Mobile</strong>: For instant pass alerts and urgent fest updates.</li>
                <li>• <strong>Official BT ID</strong>: e.g., <code>BT210036CS</code> (Capital letters, no spaces).</li>
                <li>• <strong>Department &amp; Year</strong>: Your current branch and academic year.</li>
              </ul>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center font-heading">
                  04
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Instant Activation
                </span>
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900">
                Verified Student Dashboard
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Once saved, your account receives the <strong>Verified Student Badge</strong>. You can now register for all events with 1 click, view your history, and vote in elections.
              </p>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17458F] hover:underline"
                >
                  <span>Go to Login / Profile Setup</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: EVENT REGISTRATION TUTORIAL                                   */}
        {/* ========================================================================= */}
        <section id="event-registration" className="scroll-mt-24 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
              Tutorial Part 02
            </span>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase mt-1">
              Step-by-Step Event Registration
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              How the multi-step accreditation wizard works and how your ticket is issued.
            </p>
          </div>

          <div className="space-y-4">
            
            {/* Step 1 Card */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start gap-4">
              <div className="h-10 w-10 rounded-2xl bg-[#17458F] text-white flex items-center justify-center shrink-0 font-heading font-bold text-sm">
                1
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-heading font-bold text-base sm:text-lg text-slate-900">
                  Select Event &amp; Open Registration Wizard
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  Go to <Link href="/events" className="text-[#17458F] font-bold hover:underline">Events &amp; Fests</Link>. If the event is an umbrella festival (like <em>Prarambh</em>), select your specific competition first (e.g., CodeStorm, RoboRace, Dance Battle). Tap <strong>Register Now</strong>.
                </p>
              </div>
            </div>

            {/* Step 2 Card */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start gap-4">
              <div className="h-10 w-10 rounded-2xl bg-[#17458F] text-white flex items-center justify-center shrink-0 font-heading font-bold text-sm">
                2
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-heading font-bold text-base sm:text-lg text-slate-900">
                  Review Verified Primary Details (Step 01 Info)
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  Your Full Name, BT ID, and Department are loaded directly from your authenticated profile. Check them to ensure accuracy. If you need to make corrections, update your profile first.
                </p>
              </div>
            </div>

            {/* Step 3 Card */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start gap-4">
              <div className="h-10 w-10 rounded-2xl bg-[#17458F] text-white flex items-center justify-center shrink-0 font-heading font-bold text-sm">
                3
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-heading font-bold text-base sm:text-lg text-slate-900">
                  Participation Format (Solo vs. Squad)
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  If the competition allows teams:
                </p>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1 font-medium">
                  <p>• <strong>Solo Participation</strong>: You compete individually as the delegate.</p>
                  <p>• <strong>Team / Squad</strong>: Enter your Team Name and add each teammate by typing their <strong>BT ID</strong>. The system instantly verifies their registration in the student roster and attaches them to your squad pass.</p>
                </div>
              </div>
            </div>

            {/* Step 4 Card */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start gap-4">
              <div className="h-10 w-10 rounded-2xl bg-[#17458F] text-white flex items-center justify-center shrink-0 font-heading font-bold text-sm">
                4
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-heading font-bold text-base sm:text-lg text-slate-900">
                  Custom Questionnaire (If required by organizers)
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  Fill in any competition-specific fields requested by the organizing club (e.g., GitHub repo link, track selection, dietary preference, or experience level).
                </p>
              </div>
            </div>

            {/* Step 5 Card */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start gap-4">
              <div className="h-10 w-10 rounded-2xl bg-[#17458F] text-white flex items-center justify-center shrink-0 font-heading font-bold text-sm">
                5
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-heading font-bold text-base sm:text-lg text-slate-900">
                  Review &amp; Instant Pass Generation (or Fee Checkout)
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  Review your summary. For <strong>Free Entry</strong> events, your pass generates instantly! For events with entry fees, complete the secure online payment (via Cashfree UPI, GPay, PhonePe, or Paytm) or Treasurer QR verification.
                </p>
              </div>
            </div>

            {/* Step 6 Card */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start gap-4">
              <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 font-heading font-bold text-sm">
                6
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-heading font-bold text-base sm:text-lg text-slate-900">
                  Save Your Pass &amp; Join Official WhatsApp Group
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                  Once your pass appears:
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-semibold">
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tap &quot;Download Pass Image&quot;</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 text-green-800 border border-green-200">
                    <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                    <span>Tap &quot;Join Official WhatsApp Group&quot;</span>
                  </span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: FREQUENTLY ASKED QUESTIONS & TROUBLESHOOTING                  */}
        {/* ========================================================================= */}
        <section id="faqs" className="scroll-mt-24 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
              Need Help?
            </span>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase mt-1">
              Frequently Asked Questions &amp; Troubleshooting
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Common solutions to registration issues and account questions.
            </p>
          </div>

          <Accordion items={FAQ_ITEMS} allowMultiple />
        </section>

        {/* ========================================================================= */}
        {/* SECTION 5: CONTACT / HELPDESK BANNER                                      */}
        {/* ========================================================================= */}
        <div className="p-8 sm:p-10 rounded-3xl bg-[#17458F] text-white space-y-6 shadow-xl relative overflow-hidden">
          
          <div className="relative z-10 space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#E78023] text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-[#E78023]" />
              <span>Dedicated Student Support</span>
            </div>
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-white uppercase tracking-tight">
              Still Facing Issues Registering?
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 font-medium leading-relaxed">
              If your BT ID is locked, you need ticket cancellation assistance, or you are facing issues with payment confirmation, the SRC Technical Desk is here to help.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/contact"
              className="px-6 py-3 rounded-2xl bg-[#E78023] hover:bg-[#d0701b] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center gap-2"
            >
              <span>Submit Helpdesk Grievance</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="mailto:srcjdcoem@gmail.com"
              className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition-all border border-white/20"
            >
              Email Secretariat: srcjdcoem@gmail.com
            </a>
            <Link
              href="/events"
              className="px-6 py-3 rounded-2xl bg-white text-[#17458F] hover:bg-slate-100 text-xs font-bold uppercase tracking-wider transition-all shadow-md ml-auto"
            >
              Explore Live Events &rarr;
            </Link>
          </div>

          {/* Background Ambient Glow */}
          <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-[#E78023]/20 blur-3xl pointer-events-none" />
        </div>

      </div>
    </div>
  );
}
