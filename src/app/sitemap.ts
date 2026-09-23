import { MetadataRoute } from "next";
import { mockClubs } from "@/data/clubs";
import { getAllEventsFromFirestore } from "@/lib/firebase/firestore";
import { EventItem } from "@/types";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.srcjdcoem.in";
  const now = new Date();

  // Static core routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/prarambh`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/clubs`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/hub`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/team`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/gallery`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${baseUrl}/archive`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/dashboard`,
      lastModified: now,
      changeFrequency: "always",
      priority: 0.5,
    },
  ];

  // Dynamic club charter routes
  const clubRoutes: MetadataRoute.Sitemap = mockClubs.map((club) => ({
    url: `${baseUrl}/clubs/${club.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // Dynamic live event routes (1 Event = 1 Document)
  let dynamicEvents: EventItem[] = [];
  try {
    const fsEvents = await getAllEventsFromFirestore();
    if (Array.isArray(fsEvents)) {
      dynamicEvents = fsEvents.filter(
        (e) => e.isLive !== false && e.status !== "draft" && !e.isCancelled && e.status !== "Cancelled"
      );
    }
  } catch {}

  const eventRoutes: MetadataRoute.Sitemap = dynamicEvents.map((evt) => ({
    url: `${baseUrl}/events/${evt.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.85,
  }));

  return [...staticRoutes, ...clubRoutes, ...eventRoutes];
}
