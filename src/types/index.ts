export type EventCategory = 
  | "Cultural"
  | "Technical"
  | "Sports"
  | "Competitions"
  | "Workshops"
  | "Fest";

export type EventStatus = "Registration Open" | "Upcoming" | "Completed";

export interface EventScheduleItem {
  time: string;
  title: string;
  description: string;
  venue: string;
}

export interface EventPrize {
  position: "Winner" | "Runner Up" | "Second Runner Up" | string;
  amount: string;
  perks: string[];
}

export type CustomQuestionType = 
  | "short_text" 
  | "long_text" 
  | "multiple_choice" 
  | "checkboxes" 
  | "dropdown" 
  | "note";

export interface CustomQuestion {
  id: string;
  type: CustomQuestionType;
  question: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[]; // For multiple_choice, checkboxes, dropdown
  noteContent?: string; // For "note" / important announcement banners
}

export interface EventItem {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  category: EventCategory;
  date: string;
  time: string;
  venue: string;
  organizer: string;
  organizerClubSlug?: string;
  status: EventStatus;
  isFeatured?: boolean;
  poster: string; // Base / fallback poster
  posterImage?: string; // Vertical portrait poster (3:4 or 4:5) for official notices & sidebar
  cardImage?: string; // Landscape card thumbnail (16:9) for event listings & dashboard
  headerImage?: string; // Ultra-wide cinematic banner (21:9) for event page backdrop
  description: string;
  about: string;
  whatToExpect: string[];
  rules: string[];
  schedule: EventScheduleItem[];
  prizes: EventPrize[];
  teamType: "Individual" | "Team" | "Both";
  maxTeamSize?: number;
  minTeamSize?: number;
  registrationStartDate?: string;
  registrationDeadline: string;
  entryFee?: string;
  isPaid?: boolean;
  feeAmount?: number; // Base fee per person in INR
  teamFeeAmount?: number; // Optional flat fee for entire team in INR
  feePricingModel?: "per_person" | "per_team";
  coordinatorContact?: {
    name: string;
    role: string;
    phone: string;
  };
  customQuestions?: CustomQuestion[];
}

export interface ClubLeader {
  id?: string;
  name: string;
  role: string;
  roleType?: "lead" | "coLead";
  department: string;
  year: string;
  avatar: string;
  btId?: string;
  bio?: string;
  email?: string;
  linkedin?: string;
}

export interface ClubItem {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  description: string;
  mission: string;
  iconName: string;
  memberCount: number;
  established: string;
  heroImage: string; // Base / fallback hero
  headerImage?: string; // Ultra-wide cinematic banner (21:9) for club detail page header
  cardImage?: string; // Landscape card thumbnail (16:9) for club directory grid
  logoImage?: string; // Square (1:1) club emblem / insignia logo
  lead: ClubLeader;
  coLead?: ClubLeader;
  coLeads?: ClubLeader[];
  leaders?: ClubLeader[];
  upcomingEvents?: string[];
  pastHighlights: string[];
  galleryImages: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  designation?: string;
  level?: string;
  category?: string;
  department: string;
  year?: string;
  avatar: string;
  bio?: string;
  linkedin?: string;
  email?: string;
  order?: number;
  badgeNumber?: string;
  btId?: string; // College BT ID for designation badge linkage
  clubSlug?: string; // Optional slug to navigate to club profile
}

export interface RegistrationRecord {
  id: string;
  registrationId: string;
  eventSlug: string;
  eventName: string;
  participantName: string;
  email: string;
  phone: string;
  department: string;
  year: string;
  teamType: "Individual" | "Team";
  teamName?: string;
  teamMembers?: string[];
  registeredAt: string;
  status: "CONFIRMED" | "PENDING" | "COMPLETED" | "CHECKED_IN" | "CANCELLED";
  paymentStatus?: "FREE" | "PAID" | "PENDING";
  paymentId?: string;
  orderId?: string;
  amountPaid?: number;
  ticketCode: string;
  qrPayload: string;
  btId?: string;
  customAnswers?: Record<string, any>;
}

export interface GalleryPhoto {
  id: string;
  title: string;
  category: "Events" | "Clubs" | "SRC" | "Prarambh" | "Vibrance" | "Behind the Scenes";
  imageUrl: string;
  date: string;
  caption: string;
  aspectRatio?: "landscape" | "portrait" | "square";
}
