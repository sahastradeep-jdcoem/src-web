"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { getStoredClubs, syncClubsFromFirestore, subscribeToClubs, findClub } from "@/lib/councilStore";
import { mockClubs } from "@/data/clubs";
import { ClubItem } from "@/types";
import ClubDetailView from "@/components/clubs/ClubDetailView";

export default function ClubDetailPage() {
  const params = useParams();
  const rawSlug = params?.slug as string;
  const slug = rawSlug ? decodeURIComponent(rawSlug) : "";

  const [club, setClub] = useState<ClubItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    // 1. Instant optimistic lookup in localStorage & mock data
    const localClubs = getStoredClubs();
    const localMatch = findClub(localClubs, slug) || findClub(mockClubs, slug);
    if (localMatch) {
      setClub(localMatch);
      setIsLoading(false);
    }

    // 2. Fetch authoritative cloud state from Firestore
    syncClubsFromFirestore().then((remote) => {
      if (remote && Array.isArray(remote) && remote.length > 0) {
        const remoteMatch = findClub(remote, slug);
        if (remoteMatch) {
          setClub(remoteMatch);
        }
      }
      setIsLoading(false);
    });

    // 3. Active real-time subscription
    const unsubscribe = subscribeToClubs((remoteClubs) => {
      if (remoteClubs && Array.isArray(remoteClubs) && remoteClubs.length > 0) {
        const streamMatch = findClub(remoteClubs, slug);
        if (streamMatch) {
          setClub(streamMatch);
        }
      }
    });

    const handleLocalUpdate = () => {
      const updated = getStoredClubs();
      const match = findClub(updated, slug);
      if (match) {
        setClub(match);
      }
    };

    window.addEventListener("src_clubs_updated", handleLocalUpdate);
    window.addEventListener("storage", handleLocalUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener("src_clubs_updated", handleLocalUpdate);
      window.removeEventListener("storage", handleLocalUpdate);
    };
  }, [slug]);

  // Synchronize canonical URL if accessed via legacy or alternate alias (e.g. /clubs/agentic-ai -> /clubs/robotics)
  useEffect(() => {
    if (club?.slug && slug && typeof window !== "undefined") {
      const currentParam = slug.toLowerCase().trim();
      const canonical = club.slug.toLowerCase().trim();
      if (currentParam !== canonical && (currentParam === "agentic-ai" || currentParam === "robotics-club" || currentParam.includes("robotics"))) {
        window.history.replaceState(null, "", `/clubs/${canonical}`);
      }
    }
  }, [club, slug]);

  if (isLoading && !club) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 space-y-4 font-sans">
        <div className="w-10 h-10 border-3 border-[#17458F] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-500 tracking-wide">
          Loading club charter...
        </p>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="p-8 max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-[#E78023] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-[#0F172A] font-heading">Club Charter Not Found</h2>
          <p className="text-sm text-slate-600 font-sans">
            The club charter you are looking for does not exist, has been renamed, or is currently in draft.
          </p>
          <Link
            href="/clubs"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-[#17458F] text-white font-bold text-sm hover:bg-[#123670] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Clubs Directory</span>
          </Link>
        </div>
      </div>
    );
  }

  return <ClubDetailView key={club.id || club.slug} initialClub={club} clubEvents={[]} />;
}
