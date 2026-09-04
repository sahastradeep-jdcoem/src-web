import { CustomQuestion } from "./index";

export type ListingType =
  | "event"            // 🎫 Physical/online festival, competition, workshop
  | "registration"     // 📝 Standalone event registration
  | "application"      // 👥 Club recruitment, team selection, committee interview
  | "poll"             // 📊 Live poll / voting
  | "qa"               // ❓ Q&A / Ask the SRC
  | "survey"           // 📋 Survey & feedback
  | "announcement"     // 📢 High-priority announcement / bulletin
  | "opportunity"      // 💡 Internship, volunteer drive, scholarship
  | "submission"       // 📤 File, artwork, code, or photo contest submission
  | "issue";           // 🐞 Campus grievance / feedback / complaint desk

export type ListingPillar =
  | "events"
  | "applications"
  | "voice"
  | "opportunities"
  | "submissions"
  | "community";

export type ListingStatus = "draft" | "active" | "closed" | "archived";

export type TargetAudience = "jdcoem_only" | "inter_college";

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface PollConfig {
  options: PollOption[];
  isAnonymous?: boolean;
  allowMultipleChoices?: boolean;
  hideResultsUntilClosed?: boolean;
  totalVotes?: number;
}

export interface QaConfig {
  targetPersonOrRole?: string; // e.g. "President", "Dean", "SRC Core"
  isAnonymousAllowed?: boolean;
  requireApprovalBeforeDisplay?: boolean;
}

export interface SurveyConfig {
  estimatedMinutes?: number;
  anonymous?: boolean;
  rewardText?: string;
}

export interface OpportunityConfig {
  opportunityType: "Internship" | "Volunteering" | "Core Committee" | "Fellowship" | "Project";
  stipend?: string;
  duration?: string;
  location?: "On Campus" | "Remote" | "Hybrid" | "Nagpur";
  openings?: number;
  perks?: string[];
}

export interface SubmissionConfig {
  allowedFileTypes: ("pdf" | "image" | "zip" | "link")[];
  maxFileSizeMB?: number;
  evaluationCriteria?: string[];
}

export interface IssueConfig {
  targetDepartment?: string;
  isConfidential?: boolean;
  allowAnonymous?: boolean;
  priorityLevel?: "Low" | "Medium" | "High" | "Urgent";
}

export interface ListingItem {
  id: string;
  slug: string;
  title: string;
  pillar: ListingPillar;
  type: ListingType;
  status: ListingStatus;
  isLive?: boolean;
  targetAudience?: TargetAudience; // "jdcoem_only" | "inter_college"
  isInterCollege?: boolean; // true if open to other colleges, false if campus exclusive
  summary: string;
  description: string;
  organizer: string;
  organizerClubSlug?: string;
  
  // Media Assets
  coverImage?: string;
  bannerImage?: string;
  icon?: string;

  // Key Dates
  startDate?: string;
  deadline?: string;
  publishedAt?: string;

  // Generic Hierarchy (Parent-Child)
  isParentFest?: boolean;
  parentEventId?: string;
  parentEventSlug?: string;
  parentEventName?: string;
  subEventBadge?: string;

  // Custom Q&N Form Fields
  customQuestions?: CustomQuestion[];

  // Form & Response Settings
  allowResponseEditing?: boolean; // Controlled from admin: allows students to revise/edit submitted responses
  requiresApproval?: boolean; // Controlled from admin: whether responses require approval / resolution workflow

  // Polymorphic Subtype Configs
  pollConfig?: PollConfig;
  qaConfig?: QaConfig;
  surveyConfig?: SurveyConfig;
  opportunityConfig?: OpportunityConfig;
  submissionConfig?: SubmissionConfig;
  issueConfig?: IssueConfig;
}

export interface ListingResponseRecord {
  id: string;
  listingId: string;
  listingSlug: string;
  listingType: ListingType;
  listingTitle: string;
  
  // Respondent Info
  userId?: string;
  userEmail?: string;
  userName?: string;
  userDepartment?: string;
  userYear?: string;
  btId?: string;
  isAnonymous?: boolean;

  // Responses
  answers?: Record<string, any>;
  selectedOptionIds?: string[];   // For polls
  fileUrl?: string;               // For submissions
  submissionLink?: string;        // External portfolio/repo link
  ticketCode?: string;            // For issues or registrations

  // Lifecycle
  status?: "pending" | "approved" | "rejected" | "resolved" | "reviewed";
  adminFeedback?: string;
  createdAt: string;
  updatedAt?: string;
}
