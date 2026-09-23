import type { Metadata } from "next";
import { getSiteContentFromFirestore } from "@/lib/firebase/firestore";
import { initialListings } from "@/data/listings";
import { ListingItem } from "@/types/listings";
import { DEFAULT_OG_IMAGES, DEFAULT_OG_IMAGE_URL } from "@/data/seoMetadata";


function getValidOgImageUrl(imgUrl?: string): string {
  if (!imgUrl) return DEFAULT_OG_IMAGE_URL;
  const trimmed = imgUrl.trim();
  // Social crawlers cannot fetch base64 data URLs; use fallback logo
  if (trimmed.startsWith("data:")) return DEFAULT_OG_IMAGE_URL;
  return trimmed;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  if (!slug) {
    return {
      title: "Engagement Hub | SRC JDCOEM",
      description: "Official forms, student applications, polls, and opportunities by SRC JDCOEM.",
    };
  }

  let listing: ListingItem | null = null;

  try {
    const remoteListings = await getSiteContentFromFirestore<ListingItem[]>("listings");
    const candidateListings =
      Array.isArray(remoteListings) && remoteListings.length > 0
        ? remoteListings
        : initialListings;

    listing =
      candidateListings.find(
        (item) => item.slug === slug || item.id === slug
      ) || null;
  } catch (err) {
    console.warn(`[hub/[slug]/layout] Failed to load listing for metadata (${slug}):`, err);
    listing =
      initialListings.find(
        (item) => item.slug === slug || item.id === slug
      ) || null;
  }

  // Comply with Draft Isolation Invariant (Directive #6)
  if (!listing || listing.isLive === false || listing.status === "draft") {
    return {
      title: "SRC Form & Opportunity | Engagement Hub",
      description: "Official applications, forms, polls, and opportunities by SRC JDCOEM.",
      alternates: {
        canonical: `https://www.srcjdcoem.in/hub/${slug}`,
      },
      openGraph: {
        title: "SRC Form & Opportunity | Engagement Hub",
        description: "Official applications, forms, polls, and opportunities by SRC JDCOEM.",
        url: `https://www.srcjdcoem.in/hub/${slug}`,
        siteName: "Sahastradeep - SRC JDCOEM",
        images: DEFAULT_OG_IMAGES,
      },
    };
  }

  const title = listing.title;
  const rawDescription =
    listing.summary ||
    listing.description ||
    "Official form and opportunity on the SRC JDCOEM Engagement Hub.";
  const cleanDescription =
    rawDescription.length > 200 ? `${rawDescription.slice(0, 197)}...` : rawDescription;

  // Directive: The form/listing header image (coverImage priority, then bannerImage)
  const headerImageRaw = listing.coverImage || listing.bannerImage;
  const ogImageUrl = getValidOgImageUrl(headerImageRaw);

  const listingUrl = `https://www.srcjdcoem.in/hub/${listing.slug || slug}`;

  return {
    title: `${title} | SRC JDCOEM`,
    description: cleanDescription,
    alternates: {
      canonical: listingUrl,
    },
    openGraph: {
      title: `${title} | SRC JDCOEM`,
      description: cleanDescription,
      url: listingUrl,
      siteName: "Sahastradeep - SRC JDCOEM",
      type: "website",
      images: [
        {
          url: ogImageUrl,
          alt: `${title} cover image`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | SRC JDCOEM`,
      description: cleanDescription,
      images: [ogImageUrl],
    },
  };
}

export default function HubDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
