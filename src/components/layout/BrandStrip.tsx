import React from "react";
import Image from "next/image";

export default function BrandStrip() {
  return (
    <section id="brand-strip" className="bg-white border-y border-slate-200 py-8 shadow-xs scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          
          {/* SRC Entity */}
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 sm:h-18 sm:w-18 shrink-0 p-2 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm">
              <Image
                src="/assets/SRC Logo.png"
                alt="Student Representative Council Sahastradeep"
                fill
                className="object-contain p-1"
              />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#E78023]">
                Autonomous Student Council
              </span>
              <h3 className="font-extrabold text-lg sm:text-xl text-[#17458F] tracking-wide uppercase">
                STUDENT REPRESENTATIVE COUNCIL
              </h3>
              <p className="text-xs font-semibold text-slate-600">
                SAHASTRADEEP • <span className="text-[#E78023]">सहस्रदीप</span>
              </p>
            </div>
          </div>

          {/* Institutional Divider */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 text-sm font-bold">
              ×
            </div>
          </div>

          {/* JDCOEM Entity */}
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 sm:h-18 sm:w-18 shrink-0 p-2 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm">
              <Image
                src="/assets/JDCOEM-Logo-300x300.png"
                alt="JD College of Engineering & Management"
                fill
                className="object-contain p-1"
              />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#17458F]">
                Affiliated Institution
              </span>
              <h3 className="font-extrabold text-lg sm:text-xl text-slate-900 tracking-wide uppercase">
                JD COLLEGE OF ENGG. & MGMT.
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                NAGPUR, MAHARASHTRA • NAAC ACCREDITED
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
