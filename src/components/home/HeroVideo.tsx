"use client";

import React, { useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Sparkles, ShieldCheck } from "lucide-react";

interface HeroVideoProps {
  className?: string;
}

export function HeroVideo({ className = "" }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <div className={`relative group rounded-3xl overflow-hidden bg-slate-900 border-2 border-slate-200 shadow-2xl shadow-[#17458F]/15 ${className}`}>
      {/* Ambient glowing backdrop behind video */}
      <div className="absolute -inset-1 bg-gradient-to-r from-[#17458F]/20 via-[#E78023]/25 to-[#17458F]/20 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Video Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
        <video
          ref={videoRef}
          src="/assets/0830.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
        />

        {/* Video Overlay Top Badge */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-white/15 text-white shadow-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E78023] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E78023]"></span>
            </span>
            <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-slate-100">
              Official Emblem Reveal
            </span>
          </div>

          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/70 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-[#E78023]" />
            <span>Sahastradeep</span>
          </div>
        </div>

        {/* Interactive Control Buttons (Bottom Right) */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause Video" : "Play Video"}
            className="p-2.5 rounded-full bg-slate-900/80 hover:bg-[#17458F] text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg hover:scale-105"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute Video" : "Mute Video"}
            className="p-2.5 rounded-full bg-slate-900/80 hover:bg-[#E78023] text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg hover:scale-105"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Bottom Metadata Ribbon */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex items-center justify-between text-white text-xs pointer-events-none">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#E78023]" />
            <span className="font-bold text-xs tracking-wide text-slate-200">
              Student Representative Council • JDCOEM
            </span>
          </div>
          <span className="text-[10px] font-mono font-semibold text-[#E78023] uppercase tracking-widest hidden sm:inline">
            Loop Reel 2026
          </span>
        </div>
      </div>
    </div>
  );
}
