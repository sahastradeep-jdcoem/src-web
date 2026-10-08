export type ShareableType = "event" | "form" | "listing" | "club" | "general";

export interface SocialSharePayload {
  type: ShareableType;
  typeLabel?: string;     // e.g. "OFFICIAL EVENT", "CAMPUS FESTIVAL", "SRC APPLICATION", "STUDENT POLL"
  title: string;
  subtitle?: string;      // Tagline or short summary
  description?: string;
  imageUrl?: string;      // Existing OG image, poster, or banner
  badge?: string;         // e.g. "INTER-COLLEGE", "JDCOEM ONLY", "OPEN FOR ALL"
  date?: string;          // e.g. "21 September 2026"
  time?: string;          // e.g. "10:00 AM IST"
  venue?: string;         // e.g. "Main Auditorium"
  organizer?: string;     // e.g. "SRC JDCOEM" or Club Name
  deadline?: string;      // e.g. "Ends 28 Sep"
  entryFee?: string;      // e.g. "Free Entry"
  ctaText?: string;       // e.g. "Tap to Explore" or "Open Form"
  url: string;            // Canonical URL (https://www.srcjdcoem.in/...)
}

export interface StoryPalette {
  primaryAccent: string; // e.g. #3B82F6 or extracted hex
  deepBase: string;      // e.g. #081226
  midBase: string;       // e.g. #112347
  glowColor: string;     // rgba with alpha for ambient lighting
  cardBorder: string;    // rgba hairline border
  textColor: string;     // Primary readable text color
  brandColor: string;    // #E78023 (Sahastradeep signature orange)
}

export interface StoryRenderOptions {
  includeQrCode?: boolean;
}
