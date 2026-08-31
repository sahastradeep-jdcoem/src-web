import React from "react";
import Image from "next/image";

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4 px-4">
      <div className="relative h-16 w-16 rounded-2xl bg-white p-2 border border-slate-200 shadow-md animate-pulse">
        <Image
          src="/assets/SRC Logo.png"
          alt="SRC Loading Seal"
          fill
          className="object-contain p-2"
        />
      </div>

      <div className="text-center space-y-1">
        <p className="font-heading font-bold text-sm text-[#17458F] tracking-wide">
          SAHASTRADEEP
        </p>
        <p className="text-[11px] text-slate-400 font-medium font-sans">
          Loading council data...
        </p>
      </div>
    </div>
  );
}
