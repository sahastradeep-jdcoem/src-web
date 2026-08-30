import React from "react";
import { EventScheduleItem } from "@/types";
import { Clock, MapPin } from "lucide-react";

interface ScheduleTimelineProps {
  schedule: EventScheduleItem[];
}

export function ScheduleTimeline({ schedule }: ScheduleTimelineProps) {
  if (!schedule || schedule.length === 0) return null;

  return (
    <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-2 sm:before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {schedule.map((item, index) => (
        <div key={index} className="relative group">
          {/* Pin Point */}
          <div className="absolute -left-[27px] sm:-left-[35px] top-1.5 h-4 w-4 rounded-full bg-white border-2 border-[#E78023] group-hover:bg-[#E78023] transition-all shadow-xs" />

          <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#17458F]/40 shadow-xs transition-all space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 text-[#E78023]">
                <Clock className="w-3.5 h-3.5" />
                {item.time}
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                <MapPin className="w-3.5 h-3.5 text-[#17458F]" />
                {item.venue}
              </span>
            </div>

            <h4 className="font-bold text-base sm:text-lg text-[#0F172A]">
              {item.title}
            </h4>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              {item.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
