"use client";

import React, { useState } from "react";
import Image from "next/image";
import { 
  MapPin, 
  Mail, 
  Phone, 
  Instagram, 
  Linkedin, 
  Send, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Sparkles 
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Accordion } from "@/components/ui/Accordion";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    department: "Computer Science & Engineering",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const faqs = [
    {
      id: "faq-1",
      title: "How do I register for Prarambh or other council showcases?",
      content:
        "You can register directly through our online event portal at /events. Select your target showcase, choose Individual or Team entry, review your credentials, and download your verified QR Digital Pass instantly.",
    },
    {
      id: "faq-2",
      title: "How can I join one of the 12 Student Clubs?",
      content:
        "Club recruitment drives and open auditions take place following the Prarambh assembly. You can also connect with the respective Club Head listed on the /clubs directory.",
    },
    {
      id: "faq-3",
      title: "Where is the SRC Secretariat Office located on campus?",
      content:
        "The central Student Representative Council Secretariat is located on the Ground Floor of the Main Administrative Block, JDCOEM Campus, Katol Road, Nagpur.",
    },
    {
      id: "faq-4",
      title: "Are inter-college participants allowed in Prarambh fests?",
      content:
        "Yes! Flagship events and competitions invite active collegiate delegations across Maharashtra and Central India.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8 space-y-16">
      <div className="max-w-7xl mx-auto space-y-16">
        
        {/* Page Header */}
        <div className="space-y-4 max-w-3xl">
          <Badge variant="orange" size="md">
            SECRETARIAT DESK
          </Badge>
          <h1 className="font-extrabold text-4xl sm:text-6xl text-[#0F172A] tracking-tight uppercase leading-none">
            LET&apos;S <span className="text-[#E78023]">CONNECT.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium">
            Reach out to the Student Representative Council of JD College of Engineering & Management for queries, sponsorships, club collaborations, and grievance redressals.
          </p>
        </div>

        {/* Contact Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Column: Campus & Council Coordinates */}
          <div className="space-y-6">
            
            {/* Campus Info Card */}
            <div className="p-8 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 rounded-2xl bg-slate-50 p-2 border border-slate-200 shrink-0">
                  <Image
                    src="/assets/SRC Logo.png"
                    alt="SRC Emblem"
                    fill
                    className="object-contain p-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#E78023]">
                    Secretariat
                  </span>
                  <h3 className="font-bold text-lg text-[#17458F]">
                    SAHASTRADEEP
                  </h3>
                  <p className="text-xs text-slate-500">SRC • JDCOEM Nagpur</p>
                </div>
              </div>

              <div className="space-y-4 text-xs text-slate-600 border-t border-slate-100 pt-4 font-medium">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#E78023] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-bold">Campus Address</strong>
                    <span>JD College of Engineering & Management, Khandala, Katol Road, Nagpur, Maharashtra — 441501</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#E78023] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-bold">Official Email</strong>
                    <a href="mailto:srcjdcoem@gmail.com" className="hover:text-[#17458F] transition-colors">
                      srcjdcoem@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-[#E78023] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-bold">Secretariat Helpline</strong>
                    <span>+91 712 281 0000 / 01</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-[#17458F] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 block font-bold">Council Office Hours</strong>
                    <span>Monday – Saturday: 10:00 AM – 05:30 PM IST</span>
                  </div>
                </div>
              </div>

              {/* Social Channels */}
              <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-slate-50 hover:bg-[#E78023] text-slate-600 hover:text-white border border-slate-200 transition-colors shadow-xs"
                  aria-label="Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
                <a
                  href="https://www.linkedin.com/company/src-jdcoem/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-slate-50 hover:bg-[#17458F] text-slate-600 hover:text-white border border-slate-200 transition-colors shadow-xs"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href="mailto:srcjdcoem@gmail.com"
                  className="p-3 rounded-xl bg-slate-50 hover:bg-[#3D406B] text-slate-600 hover:text-white border border-slate-200 transition-colors shadow-xs"
                  aria-label="Email SRC"
                >
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Campus Visual Map Card */}
            <div className="relative h-56 rounded-3xl overflow-hidden border border-slate-200 bg-white p-6 flex flex-col justify-between shadow-sm">
              <div className="relative z-10 space-y-1">
                <Badge variant="navy" size="sm">
                  JDCOEM CAMPUS
                </Badge>
                <h4 className="font-bold text-[#17458F] text-base">
                  Katol Road, Nagpur
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Sprawling 25-acre modern engineering campus.
                </p>
              </div>

              <div className="relative z-10 pt-4 flex items-center justify-between text-xs">
                <span className="text-[#E78023] font-bold">Directions via Google Maps</span>
                <MapPin className="w-4 h-4 text-[#E78023]" />
              </div>
            </div>

          </div>

          {/* Right 2 Columns: Query Form */}
          <div className="lg:col-span-2">
            <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 space-y-6 shadow-sm">
              
              <div className="border-b border-slate-100 pb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
                  Direct Inquiries
                </span>
                <h2 className="font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase mt-1">
                  SEND A MESSAGE TO SRC
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  We usually respond within 24–48 working hours.
                </p>
              </div>

              {submitted ? (
                <div className="p-8 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
                  <div className="inline-flex p-3 rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-xl text-emerald-900">
                    Message Dispatched!
                  </h3>
                  <p className="text-xs text-emerald-700 max-w-md mx-auto font-medium">
                    Thank you for reaching out. The SRC Secretariat team has received your query and will follow up shortly.
                  </p>
                  <Button
                    onClick={() => setSubmitted(false)}
                    variant="outline"
                    size="sm"
                  >
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formState.name}
                        onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                        placeholder="e.g. Aryan Sharma"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={formState.email}
                        onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                        placeholder="student@jdcoem.ac.in"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Department
                      </label>
                      <input
                        type="text"
                        value={formState.department}
                        onChange={(e) => setFormState({ ...formState, department: e.target.value })}
                        placeholder="e.g. Computer Science"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Subject *
                      </label>
                      <input
                        type="text"
                        required
                        value={formState.subject}
                        onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                        placeholder="e.g. Vibrance 2026 Sponsorship / Query"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Message Content *
                    </label>
                    <textarea
                      rows={5}
                      required
                      value={formState.message}
                      onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                      placeholder="Write your detailed query or proposal here..."
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F] resize-none"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      className="gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>Transmit Message</span>
                    </Button>
                  </div>
                </form>
              )}

            </div>
          </div>

        </div>

        {/* FAQs SECTION */}
        <section className="space-y-8 max-w-4xl mx-auto pt-8">
          <div className="space-y-2 text-center">
            <Badge variant="orange" size="md">
              FREQUENT INQUIRIES
            </Badge>
            <h2 className="font-extrabold text-3xl sm:text-4xl text-[#0F172A] uppercase">
              COUNCIL FAQS
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Common questions about registration, council representation, and club activities.
            </p>
          </div>

          <Accordion items={faqs} />
        </section>

      </div>
    </div>
  );
}
