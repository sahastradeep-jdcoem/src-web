"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ChevronDown, ArrowRight } from "lucide-react";
import { DEFAULT_HERO_SETTINGS, HeroSettings } from "@/data/heroSettings";
import { cn } from "@/lib/utils";

export default function HeroSection() {
  const [settings, setSettings] = useState<HeroSettings>(DEFAULT_HERO_SETTINGS);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isLoopDissolving, setIsLoopDissolving] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Smooth mouse parallax motion values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 30, stiffness: 180, mass: 0.6 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  // Parallax layer depths
  const bgShiftX = useTransform(smoothMouseX, [-0.5, 0.5], [-14, 14]);
  const bgShiftY = useTransform(smoothMouseY, [-0.5, 0.5], [-10, 10]);
  const cloudShiftX = useTransform(smoothMouseX, [-0.5, 0.5], [8, -8]);
  const cloudShiftY = useTransform(smoothMouseY, [-0.5, 0.5], [5, -5]);
  const centerShiftX = useTransform(smoothMouseX, [-0.5, 0.5], [-5, 5]);
  const centerShiftY = useTransform(smoothMouseY, [-0.5, 0.5], [-3, 3]);

  // Set video playback rate to 1.5x
  const setPlaybackSpeed = () => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 1.5;
    }
  };

  // 0.5-second loop cross-dissolve transition handler
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const duration = v.duration;
    if (!duration || isNaN(duration)) return;

    const timeRemaining = duration - v.currentTime;
    // Activate 0.5s dissolve transition near the loop boundary
    const shouldDissolve = timeRemaining <= 0.5 || v.currentTime <= 0.35;
    setIsLoopDissolving(shouldDissolve);
  };

  // Real-time dynamic hero settings synchronization
  useEffect(() => {
    const loadSettings = () => {
      try {
        const stored = localStorage.getItem("src_hero_settings");
        if (stored) {
          setSettings(JSON.parse(stored));
        }
      } catch (e) {
        console.warn("Could not load stored hero settings", e);
      }
    };

    loadSettings();

    const handleUpdate = (e: any) => {
      if (e?.detail) {
        setSettings(e.detail);
      } else {
        loadSettings();
      }
    };

    window.addEventListener("src_hero_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("src_hero_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  useEffect(() => {
    setPlaybackSpeed();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section
      ref={heroRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-[calc(100vh-4rem)] min-h-[680px] max-h-[1080px] flex flex-col items-center justify-between overflow-hidden bg-[#F4F1E8] select-none"
    >
      {/* 1. LAYER 0: CRISP FULL-SCALE BACKGROUND IMAGE WITH PARALLAX */}
      <motion.div 
        style={{ x: bgShiftX, y: bgShiftY }}
        className="absolute -inset-8 z-0 pointer-events-none"
      >
        <Image
          key={settings.bgImageUrl}
          src={settings.bgImageUrl || DEFAULT_HERO_SETTINGS.bgImageUrl}
          alt={settings.bgTitle || "SRC JDCOEM Campus"}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-95 scale-[1.03] filter contrast-[1.04] brightness-[1.02] transition-opacity duration-700"
        />

        {/* Soft color harmony lens that matches the video's ivory backdrop tone */}
        <div 
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 65% 55% at 50% 45%, rgba(245,244,239,0.82) 0%, rgba(245,244,239,0.5) 45%, rgba(245,244,239,0.15) 75%, transparent 100%)",
          }}
        />
      </motion.div>

      {/* 2. LAYER 1: VOLUMETRIC MATCHING-TONE CLOUDS & FOCUSED AMBIENT MIST */}
      <motion.div 
        style={{ x: cloudShiftX, y: cloudShiftY }}
        className="absolute inset-0 z-10 pointer-events-none overflow-hidden"
      >
        {/* Subtle top edge transition to navbar (Matching #F5F4EF / white) */}
        <div 
          className="absolute top-0 left-0 right-0 h-28 opacity-45 blur-2xl"
          style={{
            background: "linear-gradient(to bottom, rgba(245,244,239,0.9) 0%, transparent 100%)",
          }}
        />

        {/* Subtle bottom edge transition to content canvas */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-32 opacity-65 blur-2xl"
          style={{
            background: "linear-gradient(to top, rgba(245,244,239,0.95) 0%, rgba(248,250,252,0.6) 50%, transparent 100%)",
          }}
        />

        {/* Volumetric Clouds matching the exact off-white/ivory color of the loop video */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] sm:w-[680px] lg:w-[780px] h-[440px] sm:h-[540px] rounded-full blur-[70px] opacity-95"
          style={{
            background: "radial-gradient(ellipse at center, #F5F4EF 0%, rgba(245,244,239,0.92) 42%, rgba(245,244,239,0.45) 68%, transparent 100%)",
          }}
        />

        {/* Soft Golden Sunbeam Burst behind logo */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] rounded-full opacity-30 mix-blend-soft-light animate-pulse"
          style={{
            background: "conic-gradient(from 0deg at 50% 50%, rgba(230,101,25,0.35) 0deg, transparent 45deg, rgba(30,49,91,0.2) 90deg, transparent 135deg, rgba(230,101,25,0.35) 180deg, transparent 225deg, rgba(30,49,91,0.2) 270deg, transparent 315deg, rgba(230,101,25,0.35) 360deg)",
            animationDuration: "14s",
          }}
        />
      </motion.div>

      {/* Top Spacer */}
      <div className="h-6 sm:h-10" />

      {/* 3. LAYER 2: CENTERPIECE — 3D LOGO REVEAL LOOP VIDEO (WITH 0.5s DISSOLVE TRANSITION) */}
      <motion.div 
        style={{ x: centerShiftX, y: centerShiftY }}
        className="relative z-20 flex flex-col items-center justify-center my-auto px-4"
      >
        {/* Luminous warm ambient aura directly behind video matching #F5F4EF and golden tone */}
        <div 
          className="absolute w-72 h-72 sm:w-96 sm:h-96 md:w-[460px] md:h-[460px] rounded-full blur-3xl pointer-events-none"
          style={{
            background: "radial-gradient(circle, #F5F4EF 0%, rgba(230,101,25,0.25) 35%, rgba(30,49,91,0.1) 65%, transparent 100%)",
          }}
        />

        {/* 3D Animated Logo Reveal Video Container */}
        <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-[380px] md:h-[380px] lg:w-[430px] lg:h-[430px] flex items-center justify-center overflow-hidden mix-blend-multiply">
          {/* Static fallback frame for reduced motion */}
          <div className="absolute inset-0 hidden motion-reduce:block">
            <Image
              src="/assets/SRC Logo.png"
              alt="SRC Seal"
              fill
              className="object-contain p-8"
            />
          </div>

          {/* Video with object-cover, circular radial mask, 1.5x speed, and 0.5s loop dissolve transition */}
          <video
            ref={videoRef}
            src="/assets/0830.mp4"
            autoPlay
            loop
            muted
            playsInline
            onLoadedMetadata={setPlaybackSpeed}
            onTimeUpdate={handleTimeUpdate}
            onPlay={setPlaybackSpeed}
            onLoadedData={() => {
              setIsVideoLoaded(true);
              setPlaybackSpeed();
            }}
            className={cn(
              "w-full h-full object-cover rounded-full mix-blend-multiply motion-reduce:hidden transition-all duration-500 ease-in-out",
              isLoopDissolving ? "opacity-35 blur-[0.6px]" : "opacity-100 blur-0"
            )}
            style={{
              WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 46%, rgba(0,0,0,0.85) 54%, transparent 64%)",
              maskImage: "radial-gradient(circle at 50% 50%, black 46%, rgba(0,0,0,0.85) 54%, transparent 64%)",
            }}
          />
        </div>

        {/* 4. LAYER 3: EDITORIAL MOTTO & CALL TO ACTION */}
        <div className="text-center space-y-2 mt-2 sm:mt-3 z-30 max-w-xl">
          
          <h2 className="font-heading font-bold text-xs sm:text-sm md:text-base tracking-[0.25em] text-[#1E315B] uppercase drop-shadow-xs">
            {settings.heroOverline || DEFAULT_HERO_SETTINGS.heroOverline}
          </h2>

          <h1 className="font-hero text-lg sm:text-2xl md:text-3xl tracking-[0.20em] text-[#0F172A] uppercase leading-tight drop-shadow-xs">
            {settings.heroHeadline || DEFAULT_HERO_SETTINGS.heroHeadline}
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 font-sans font-medium italic pt-0.5">
            {settings.heroTagline || DEFAULT_HERO_SETTINGS.heroTagline}
          </p>

          <div className="pt-3 sm:pt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#E78023] hover:bg-[#D26E17] text-white text-xs font-semibold uppercase tracking-wider transition-all duration-200 shadow-md shadow-[#E78023]/25 group font-sans cursor-pointer"
            >
              <span>Explore Events</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>

            <Link
              href="/clubs"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/80 hover:bg-white text-[#17458F] border border-slate-300 text-xs font-semibold uppercase tracking-wider transition-all duration-200 shadow-xs backdrop-blur-sm font-sans cursor-pointer"
            >
              <span>Chartered Clubs</span>
            </Link>
          </div>

        </div>
      </motion.div>

      {/* 5. BOTTOM TICKER & SCROLL ARROW */}
      <div className="relative z-20 w-full pb-3 sm:pb-4 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold text-slate-500 font-mono tracking-widest uppercase bg-white/85 px-4 py-1.5 rounded-full border border-slate-200 shadow-xs backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-[#E78023] animate-ping" />
          <span>{settings.tickerText || DEFAULT_HERO_SETTINGS.tickerText}</span>
        </div>

        <a
          href="#explore"
          aria-label="Scroll down to explore"
          className="text-slate-400 hover:text-[#17458F] transition-colors p-1"
        >
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </a>
      </div>
    </section>
  );
}
