import React from "react";
import { notFound } from "next/navigation";
import { mockClubs } from "@/data/clubs";
import ClubDetailView from "@/components/clubs/ClubDetailView";

interface ClubPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return mockClubs.map((club) => ({
    slug: club.slug,
  }));
}

export default async function ClubDetailPage({ params }: ClubPageProps) {
  const { slug } = await params;
  const club = mockClubs.find((c) => c.slug === slug);

  if (!club) {
    notFound();
  }

  return <ClubDetailView initialClub={club} clubEvents={[]} />;
}
