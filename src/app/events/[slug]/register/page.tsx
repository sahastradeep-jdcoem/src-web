import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { mockEvents } from "@/data/events";
import { RegistrationWizard } from "@/components/registration/RegistrationWizard";
import { Badge } from "@/components/ui/Badge";

interface RegisterPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return mockEvents.map((event) => ({
    slug: event.slug,
  }));
}

export default async function EventRegisterPage({ params }: RegisterPageProps) {
  const { slug } = await params;
  const event = mockEvents.find((e) => e.slug === slug);

  if (!event) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={`/events/${event.slug}`}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-[#E78023] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Event Details</span>
          </Link>

          <div className="flex items-center gap-2">
            <Badge variant="orange" size="sm">
              LIVE REGISTRATION
            </Badge>
          </div>
        </div>

        {/* Header Title */}
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
            SRC Event Accreditation
          </span>
          <h1 className="font-extrabold text-3xl sm:text-5xl text-[#0F172A] tracking-tight uppercase">
            {event.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {event.date} • {event.venue}
          </p>
        </div>

        {/* Multi-Step Registration Wizard Form */}
        <RegistrationWizard event={event} />

      </div>
    </div>
  );
}
