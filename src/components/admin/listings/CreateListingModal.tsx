"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Calendar, 
  Users, 
  Vote, 
  Briefcase, 
  UploadCloud, 
  ShieldAlert, 
  ArrowRight, 
  Plus, 
  Trash2, 
  CheckCircle2,
  Sparkles,
  HelpCircle,
  FileText,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Info,
  Globe,
  Sliders,
  Check,
  Loader2,
  Clock,
  Building2,
  ShieldCheck,
  FolderArchive,
  Link2,
  FileArchive
} from "lucide-react";
import { ListingItem, ListingType, ListingPillar, TargetAudience } from "@/types/listings";
import { CustomQuestionsBuilder } from "@/components/admin/events/CustomQuestionsBuilder";
import { ImageUploadDropzone } from "@/components/ui/ImageUploadDropzone";
import { CustomQuestion } from "@/types";
import { saveStoredListings, getStoredListings } from "@/lib/listingsStore";
import { cn } from "@/lib/utils";

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEventModal?: () => void;
  onSuccess?: (item: ListingItem) => void;
  mode?: "create" | "edit";
  initialData?: ListingItem | null;
}

interface PillarOption {
  pillar: ListingPillar;
  type: ListingType;
  title: string;
  badge: string;
  description: string;
  icon: React.ElementType;
  gradient: string;
  isEventStudio?: boolean;
}

export type ListingModalSection = "details" | "setup" | "visuals" | "qa";

interface ListingSectionDef {
  id: ListingModalSection;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  description: string;
}

const PILLAR_OPTIONS: PillarOption[] = [
  {
    pillar: "events",
    type: "event",
    title: "Event & Competition",
    badge: "STAGE & CARNIVAL",
    description: "Launch a collegiate festival, parent showcase, tournament, or workshop with passes & prizes.",
    icon: Calendar,
    gradient: "from-blue-600 to-indigo-700",
    isEventStudio: true,
  },
  {
    pillar: "voice",
    type: "poll",
    title: "Live Student Poll",
    badge: "CAMPUS VOTING",
    description: "Collect live votes and campus sentiment with instant percentage charts and 1-vote integrity.",
    icon: Vote,
    gradient: "from-amber-500 to-orange-600",
  },
  {
    pillar: "opportunities",
    type: "opportunity",
    title: "Opportunity & Internship",
    badge: "CAREERS & GRANTS",
    description: "Publish tech internships, volunteer drives, or council fellowships with stipends and perks.",
    icon: Briefcase,
    gradient: "from-emerald-600 to-teal-700",
  },
  {
    pillar: "applications",
    type: "application",
    title: "Club & Team Recruitment",
    badge: "INTERVIEWS & SELECTION",
    description: "Recruit core coordinators, technical specialists, or club members with custom application Q&A.",
    icon: Users,
    gradient: "from-purple-600 to-pink-600",
  },
  {
    pillar: "submissions",
    type: "submission",
    title: "Contest File Submission",
    badge: "PORTFOLIO & MEDIA",
    description: "Host photography drives, logo design contests, or coding repo challenges with file uploads.",
    icon: UploadCloud,
    gradient: "from-cyan-600 to-blue-700",
  },
  {
    pillar: "community",
    type: "issue",
    title: "Grievance & Feedback Desk",
    badge: "CONFIDENTIAL TICKETS",
    description: "Establish a direct, trackable issue resolution portal for campus infrastructure, labs, or canteen.",
    icon: ShieldAlert,
    gradient: "from-rose-600 to-red-700",
  },
];

const PRESET_COVERS = [
  {
    title: "Campus Life",
    url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop",
    category: "Campus",
  },
  {
    title: "Tech & Code",
    url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop",
    category: "Technical",
  },
  {
    title: "Campus Voting",
    url: "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?q=80&w=1200&auto=format&fit=crop",
    category: "Democracy",
  },
  {
    title: "Design & Art",
    url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=1200&auto=format&fit=crop",
    category: "Creative",
  },
  {
    title: "Leadership",
    url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop",
    category: "Council",
  },
];

function getSectionsForType(type?: ListingType): ListingSectionDef[] {
  switch (type) {
    case "poll":
      return [
        {
          id: "details",
          label: "Listing Details",
          shortLabel: "Details",
          icon: FileText,
          description: "Poll question, organizing entity, campus eligibility, and schedule.",
        },
        {
          id: "setup",
          label: "Poll Choices",
          shortLabel: "Choices",
          icon: Vote,
          description: "Configure voting options, ballot parameters, and anonymity.",
        },
        {
          id: "visuals",
          label: "Visual Asset",
          shortLabel: "Visuals",
          icon: ImageIcon,
          description: "Cover graphic, theme banner, or institutional header asset.",
        },
      ];
    case "opportunity":
      return [
        {
          id: "details",
          label: "Listing Details",
          shortLabel: "Details",
          icon: FileText,
          description: "Headline, host entity, eligibility, deadline, and overview.",
        },
        {
          id: "setup",
          label: "Role Parameters",
          shortLabel: "Parameters",
          icon: Briefcase,
          description: "Role type, openings count, stipend, duration, and perks.",
        },
        {
          id: "visuals",
          label: "Visual Asset",
          shortLabel: "Visuals",
          icon: ImageIcon,
          description: "Program banner, visual backdrop, or header asset.",
        },
        {
          id: "qa",
          label: "Application Q&A",
          shortLabel: "Q&A",
          icon: HelpCircle,
          description: "Custom screening questions, portfolio prompts, and candidate intake fields.",
        },
      ];
    case "application":
      return [
        {
          id: "details",
          label: "Drive Details",
          shortLabel: "Details",
          icon: FileText,
          description: "Drive headline, recruiting entity, eligibility, and deadline.",
        },
        {
          id: "setup",
          label: "Recruitment Setup",
          shortLabel: "Setup",
          icon: Users,
          description: "Designated role, committee wing, and prerequisites.",
        },
        {
          id: "visuals",
          label: "Visual Asset",
          shortLabel: "Visuals",
          icon: ImageIcon,
          description: "Recruitment poster, header graphic, or official banner.",
        },
        {
          id: "qa",
          label: "Candidate Q&A",
          shortLabel: "Q&A",
          icon: HelpCircle,
          description: "Candidate questionnaire, statement of purpose, and custom inquiries.",
        },
      ];
    case "submission":
      return [
        {
          id: "details",
          label: "Contest Details",
          shortLabel: "Details",
          icon: FileText,
          description: "Contest headline, entity, eligibility, deadline, and rules.",
        },
        {
          id: "setup",
          label: "Submission Rules",
          shortLabel: "Rules",
          icon: UploadCloud,
          description: "Allowed formats (Images, PDF, Links), max file size, and guidelines.",
        },
        {
          id: "visuals",
          label: "Visual Asset",
          shortLabel: "Visuals",
          icon: ImageIcon,
          description: "Contest visual poster, cover graphic, or header asset.",
        },
        {
          id: "qa",
          label: "Submission Q&A",
          shortLabel: "Q&A",
          icon: HelpCircle,
          description: "Project metadata, abstract, demo link, and custom entry questions.",
        },
      ];
    case "issue":
      return [
        {
          id: "details",
          label: "Desk Overview",
          shortLabel: "Details",
          icon: FileText,
          description: "Desk headline, grievance category, eligibility, and reporting scope.",
        },
        {
          id: "setup",
          label: "Desk Security",
          shortLabel: "Security",
          icon: ShieldAlert,
          description: "Target department, priority tier, encryption, and anonymous settings.",
        },
        {
          id: "visuals",
          label: "Visual Asset",
          shortLabel: "Visuals",
          icon: ImageIcon,
          description: "Desk banner or institutional visual identification asset.",
        },
        {
          id: "qa",
          label: "Intake Q&A",
          shortLabel: "Q&A",
          icon: HelpCircle,
          description: "Incident location, room number, urgency details, and inquiry fields.",
        },
      ];
    default:
      return [
        {
          id: "details",
          label: "Details",
          shortLabel: "Details",
          icon: FileText,
          description: "Headline, organizing entity, eligibility, and description.",
        },
        {
          id: "setup",
          label: "Setup",
          shortLabel: "Setup",
          icon: Sliders,
          description: "Specific parameters and configuration settings.",
        },
        {
          id: "visuals",
          label: "Visual Asset",
          shortLabel: "Visuals",
          icon: ImageIcon,
          description: "Cover image and graphical assets.",
        },
        {
          id: "qa",
          label: "Q&A",
          shortLabel: "Q&A",
          icon: HelpCircle,
          description: "Custom questions and inquiry fields.",
        },
      ];
  }
}

export function CreateListingModal({
  isOpen,
  onClose,
  onOpenEventModal,
  onSuccess,
  mode = "create",
  initialData,
}: CreateListingModalProps) {
  const [step, setStep] = useState<"select_type" | "configure_form">("select_type");
  const [selectedPillarOption, setSelectedPillarOption] = useState<PillarOption | null>(null);
  const [activeSection, setActiveSection] = useState<ListingModalSection>("details");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingUploads, setPendingUploads] = useState<number>(0);

  // 1. Details Section State
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [organizer, setOrganizer] = useState("SRC JDCOEM");
  const [deadline, setDeadline] = useState("");
  const [targetAudience, setTargetAudience] = useState<TargetAudience>("inter_college");

  // 2. Setup Section State (Subtype Specific)
  // Poll
  const [pollOptions, setPollOptions] = useState<string[]>(["Option A", "Option B"]);
  const [pollAnonymous, setPollAnonymous] = useState(false);
  const [pollMultipleChoices, setPollMultipleChoices] = useState(false);
  // Opportunity
  const [oppRoleType, setOppRoleType] = useState<"Internship" | "Volunteering" | "Core Committee" | "Fellowship" | "Project">("Internship");
  const [oppStipend, setOppStipend] = useState("");
  const [oppDuration, setOppDuration] = useState("");
  const [oppOpenings, setOppOpenings] = useState(2);
  const [oppLocation, setOppLocation] = useState<"On Campus" | "Remote" | "Hybrid" | "Nagpur">("On Campus");
  const [oppPerks, setOppPerks] = useState<string>("");
  // Application (Recruitment)
  const [appRole, setAppRole] = useState("");
  const [appWing, setAppWing] = useState("Technical Activities");
  const [appCommitment, setAppCommitment] = useState("4-6 Hours / Week");
  const [appPrereqs, setAppPrereqs] = useState("");
  // Submission
  const [subAllowedTypes, setSubAllowedTypes] = useState<("image" | "pdf" | "zip" | "link")[]>(["image", "pdf"]);
  const [subMaxMb, setSubMaxMb] = useState<number>(20);
  const [subRules, setSubRules] = useState<string>("");
  // Issue / Grievance
  const [issueDept, setIssueDept] = useState("Central Campus Amenities");
  const [issueConfidential, setIssueConfidential] = useState(true);
  const [issueAnonymous, setIssueAnonymous] = useState(true);
  const [issuePriority, setIssuePriority] = useState<"Low" | "Medium" | "High" | "Urgent">("Medium");

  // 3. Visuals Section State
  const [coverImage, setCoverImage] = useState("https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop");

  // 4. Q&A Section State
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && initialData) {
      const matchedOpt = PILLAR_OPTIONS.find((p) => p.type === initialData.type) || PILLAR_OPTIONS[1];
      setSelectedPillarOption(matchedOpt);
      setStep("configure_form");
      setActiveSection("details");
      setFormError(null);

      setTitle(initialData.title || "");
      setSummary(initialData.summary || "");
      setDescription(initialData.description || "");
      setOrganizer(initialData.organizer || "SRC JDCOEM");
      setDeadline(initialData.deadline || "");
      setTargetAudience(initialData.targetAudience || (initialData.isInterCollege ? "inter_college" : "jdcoem_only"));
      setCoverImage(initialData.coverImage || PRESET_COVERS[0].url);
      setCustomQuestions(initialData.customQuestions || []);

      if (initialData.pollConfig) {
        setPollOptions(
          initialData.pollConfig.options && initialData.pollConfig.options.length > 0
            ? initialData.pollConfig.options.map((o) => o.text)
            : ["Option A", "Option B"]
        );
        setPollAnonymous(!!initialData.pollConfig.isAnonymous);
        setPollMultipleChoices(!!initialData.pollConfig.allowMultipleChoices);
      }

      if (initialData.opportunityConfig) {
        setOppRoleType(initialData.opportunityConfig.opportunityType || "Internship");
        setOppStipend(initialData.opportunityConfig.stipend || "");
        setOppDuration(initialData.opportunityConfig.duration || "");
        setOppLocation(initialData.opportunityConfig.location || "On Campus");
        setOppOpenings(initialData.opportunityConfig.openings || 2);
        setOppPerks(initialData.opportunityConfig.perks?.join("\n") || "");
      }

      if (initialData.submissionConfig) {
        setSubAllowedTypes(initialData.submissionConfig.allowedFileTypes || ["image", "pdf"]);
        setSubMaxMb(initialData.submissionConfig.maxFileSizeMB || 20);
        setSubRules(initialData.submissionConfig.evaluationCriteria?.join("\n") || "");
      }

      if (initialData.issueConfig) {
        setIssueDept(initialData.issueConfig.targetDepartment || "Central Campus Amenities");
        setIssueConfidential(initialData.issueConfig.isConfidential ?? true);
        setIssueAnonymous(initialData.issueConfig.allowAnonymous ?? true);
        setIssuePriority(initialData.issueConfig.priorityLevel || "Medium");
      }
    } else {
      setStep("select_type");
      setSelectedPillarOption(null);
      setActiveSection("details");
      setFormError(null);
      setTitle("");
      setSummary("");
      setDescription("");
      setOrganizer("SRC JDCOEM");
      setDeadline("");
      setTargetAudience("inter_college");
      setCoverImage("https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop");
      setCustomQuestions([]);
      setPollOptions(["Option A", "Option B"]);
      setPollAnonymous(false);
      setPollMultipleChoices(false);
      setOppRoleType("Internship");
      setOppStipend("");
      setOppDuration("");
      setOppLocation("On Campus");
      setOppOpenings(2);
      setOppPerks("");
      setAppRole("");
      setAppWing("Technical Activities");
      setAppCommitment("4-6 Hours / Week");
      setAppPrereqs("");
      setSubAllowedTypes(["image", "pdf"]);
      setSubMaxMb(20);
      setSubRules("");
      setIssueDept("Central Campus Amenities");
      setIssueConfidential(true);
      setIssueAnonymous(true);
      setIssuePriority("Medium");
    }
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  const sections = getSectionsForType(selectedPillarOption?.type);
  const currentSectionIndex = sections.findIndex((s) => s.id === activeSection);
  const prevSection = currentSectionIndex > 0 ? sections[currentSectionIndex - 1] : null;
  const nextSection = currentSectionIndex < sections.length - 1 ? sections[currentSectionIndex + 1] : null;

  const handleSelectPillar = (option: PillarOption) => {
    if (option.isEventStudio) {
      if (onOpenEventModal) {
        onClose();
        onOpenEventModal();
      }
      return;
    }
    setSelectedPillarOption(option);
    setActiveSection("details");
    setFormError(null);
    setStep("configure_form");
  };

  const handleBackToSelect = () => {
    setStep("select_type");
    setSelectedPillarOption(null);
    setActiveSection("details");
    setFormError(null);
  };

  const toggleSubAllowedType = (type: "image" | "pdf" | "zip" | "link") => {
    if (subAllowedTypes.includes(type)) {
      if (subAllowedTypes.length > 1) {
        setSubAllowedTypes(subAllowedTypes.filter((t) => t !== type));
      }
    } else {
      setSubAllowedTypes([...subAllowedTypes, type]);
    }
  };

  const handleSectionNav = (direction: "next" | "prev") => {
    if (direction === "next") {
      if (activeSection === "details" && !title.trim()) {
        setFormError("Please provide a Title / Headline in the Details section before continuing.");
        return;
      }
      if (nextSection) {
        setActiveSection(nextSection.id);
        setFormError(null);
      }
    } else if (direction === "prev" && prevSection) {
      setActiveSection(prevSection.id);
      setFormError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPillarOption) return;

    if (!title.trim()) {
      setActiveSection("details");
      setFormError("Please provide a Title / Headline in the Details section before saving.");
      return;
    }

    // EDIT MODE: Update existing item in place
    if (mode === "edit" && initialData) {
      const updatedListing: ListingItem = {
        ...initialData,
        title: title.trim(),
        targetAudience,
        isInterCollege: targetAudience === "inter_college",
        summary: summary.trim() || title.trim(),
        description: description.trim() || summary.trim() || title.trim(),
        organizer: organizer.trim() || "SRC JDCOEM",
        coverImage: coverImage || PRESET_COVERS[0].url,
        deadline: deadline || undefined,
        customQuestions: customQuestions.length > 0 ? customQuestions : undefined,
      };

      if (selectedPillarOption.type === "poll") {
        const existingOpts = initialData.pollConfig?.options || [];
        updatedListing.pollConfig = {
          ...initialData.pollConfig,
          options: pollOptions.filter((o) => o.trim()).map((text, idx) => {
            const prev = existingOpts[idx];
            return {
              id: prev?.id || `opt-${idx + 1}`,
              text: text.trim(),
              votes: prev?.votes || 0,
            };
          }),
          isAnonymous: pollAnonymous,
          allowMultipleChoices: pollMultipleChoices,
          totalVotes: initialData.pollConfig?.totalVotes || 0,
        };
      } else if (selectedPillarOption.type === "opportunity") {
        updatedListing.opportunityConfig = {
          opportunityType: oppRoleType,
          stipend: oppStipend.trim() || undefined,
          duration: oppDuration.trim() || undefined,
          location: oppLocation,
          openings: Number(oppOpenings) || 1,
          perks: oppPerks ? oppPerks.split("\n").filter((p) => p.trim()) : undefined,
        };
      } else if (selectedPillarOption.type === "application") {
        if (appRole || appWing || appCommitment || appPrereqs) {
          updatedListing.description = [
            description.trim(),
            appRole ? `\n\n**Designated Role:** ${appRole}` : "",
            appWing ? `\n**Wing/Committee:** ${appWing}` : "",
            appCommitment ? `\n**Time Commitment:** ${appCommitment}` : "",
            appPrereqs ? `\n**Prerequisites:** ${appPrereqs}` : "",
          ].filter(Boolean).join("");
        }
      } else if (selectedPillarOption.type === "submission") {
        updatedListing.submissionConfig = {
          allowedFileTypes: subAllowedTypes,
          maxFileSizeMB: Number(subMaxMb) || 20,
          evaluationCriteria: subRules ? subRules.split("\n").filter((r) => r.trim()) : undefined,
        };
      } else if (selectedPillarOption.type === "issue") {
        updatedListing.issueConfig = {
          targetDepartment: issueDept.trim() || "Central Campus Administration",
          isConfidential: issueConfidential,
          allowAnonymous: issueAnonymous,
          priorityLevel: issuePriority,
        };
      }

      const current = getStoredListings();
      const updated = current.map((item) => (item.id === initialData.id ? updatedListing : item));
      saveStoredListings(updated);

      if (onSuccess) onSuccess(updatedListing);
      onClose();
      return;
    }

    // CREATE MODE: Create fresh listing item
    const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const uniqueSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

    const newListing: ListingItem = {
      id: `list-${Date.now()}`,
      slug: uniqueSlug,
      title: title.trim(),
      pillar: selectedPillarOption.pillar,
      type: selectedPillarOption.type,
      status: "active",
      isLive: true,
      targetAudience,
      isInterCollege: targetAudience === "inter_college",
      summary: summary.trim() || title.trim(),
      description: description.trim() || summary.trim() || title.trim(),
      organizer: organizer.trim() || "SRC JDCOEM",
      coverImage: coverImage || PRESET_COVERS[0].url,
      deadline: deadline || undefined,
      customQuestions: customQuestions.length > 0 ? customQuestions : undefined,
    };

    // Attach Subtype Configs
    if (selectedPillarOption.type === "poll") {
      newListing.pollConfig = {
        options: pollOptions.filter((o) => o.trim()).map((text, idx) => ({
          id: `opt-${idx + 1}`,
          text: text.trim(),
          votes: 0,
        })),
        isAnonymous: pollAnonymous,
        allowMultipleChoices: pollMultipleChoices,
        totalVotes: 0,
      };
    } else if (selectedPillarOption.type === "opportunity") {
      newListing.opportunityConfig = {
        opportunityType: oppRoleType,
        stipend: oppStipend.trim() || undefined,
        duration: oppDuration.trim() || undefined,
        location: oppLocation,
        openings: Number(oppOpenings) || 1,
        perks: oppPerks ? oppPerks.split("\n").filter((p) => p.trim()) : undefined,
      };
    } else if (selectedPillarOption.type === "application") {
      if (appRole || appWing || appCommitment || appPrereqs) {
        newListing.description = [
          description.trim(),
          appRole ? `\n\n**Designated Role:** ${appRole}` : "",
          appWing ? `\n**Wing/Committee:** ${appWing}` : "",
          appCommitment ? `\n**Time Commitment:** ${appCommitment}` : "",
          appPrereqs ? `\n**Prerequisites:** ${appPrereqs}` : "",
        ].filter(Boolean).join("");
      }
    } else if (selectedPillarOption.type === "submission") {
      newListing.submissionConfig = {
        allowedFileTypes: subAllowedTypes,
        maxFileSizeMB: Number(subMaxMb) || 20,
        evaluationCriteria: subRules ? subRules.split("\n").filter((r) => r.trim()) : undefined,
      };
    } else if (selectedPillarOption.type === "issue") {
      newListing.issueConfig = {
        targetDepartment: issueDept.trim() || "Central Campus Administration",
        isConfidential: issueConfidential,
        allowAnonymous: issueAnonymous,
        priorityLevel: issuePriority,
      };
    }

    const current = getStoredListings();
    const updated = [newListing, ...current];
    saveStoredListings(updated);

    if (onSuccess) onSuccess(newListing);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-6 font-sans flex flex-col max-h-[90vh]">
        
        {/* Header Strip */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-[#17458F] text-white flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#E78023] text-white shadow-xs">
                {mode === "edit" ? "EDIT ACTIVE LISTING" : "SRC ENGAGEMENT STUDIO"}
              </span>
              {step === "configure_form" && selectedPillarOption && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  • {selectedPillarOption.title}
                </span>
              )}
            </div>
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-white uppercase tracking-tight">
              {mode === "edit"
                ? `Edit ${selectedPillarOption?.title || "Listing"}`
                : step === "select_type"
                ? "What would you like to publish?"
                : `Create ${selectedPillarOption?.title}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: CATEGORY PICKER */}
        {step === "select_type" && (
          <div className="p-6 sm:p-8 space-y-6 overflow-y-auto">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 font-medium">
                Choose an engagement primitive below to launch interactive forms, real-time polls, recruitment drives, or official campus notices.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PILLAR_OPTIONS.map((opt) => {
                const IconComponent = opt.icon;
                return (
                  <button
                    key={opt.title}
                    type="button"
                    onClick={() => handleSelectPillar(opt)}
                    className="group relative text-left p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#17458F] hover:shadow-lg transition-all flex flex-col justify-between cursor-pointer space-y-4 hover:-translate-y-0.5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${opt.gradient} text-white shadow-sm`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <span className="text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {opt.badge}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-heading font-extrabold text-base text-[#0F172A] uppercase group-hover:text-[#17458F] transition-colors">
                          {opt.title}
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-sans">
                          {opt.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#17458F]">
                      <span>Select Template</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: MULTI-SECTION DYNAMIC STUDIO FORM */}
        {step === "configure_form" && selectedPillarOption && (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 text-left">
            
            {/* Top Navigation & Segmented Tabs Strip */}
            <div className="p-4 sm:px-6 bg-slate-50/90 border-b border-slate-200 shrink-0 space-y-3">
              <div className="flex items-center justify-between">
                {mode !== "edit" ? (
                  <button
                    type="button"
                    onClick={handleBackToSelect}
                    className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-[#17458F] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    &larr; Choose Different Type
                  </button>
                ) : (
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    Editing Mode ({selectedPillarOption.title})
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#17458F]/10 text-[#17458F]">
                    {selectedPillarOption.pillar}
                  </span>
                  <span className="text-xs font-bold text-[#E78023] uppercase tracking-wider hidden sm:inline">
                    {mode === "edit" ? "Direct Cloud Update" : "Publishing to Live Hub"}
                  </span>
                </div>
              </div>

              {/* Segmented Section Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {sections.map((sec) => {
                  const Icon = sec.icon;
                  const isActive = activeSection === sec.id;
                  
                  // Compute dynamic micro badge
                  let badge = "";
                  if (sec.id === "details") {
                    badge = title.trim() ? "Ready" : "Required";
                  } else if (sec.id === "setup") {
                    if (selectedPillarOption.type === "poll") {
                      badge = `${pollOptions.filter((o) => o.trim()).length} Choices`;
                    } else if (selectedPillarOption.type === "opportunity") {
                      badge = oppRoleType;
                    } else if (selectedPillarOption.type === "submission") {
                      badge = `${subAllowedTypes.length} Types`;
                    } else if (selectedPillarOption.type === "issue") {
                      badge = issuePriority;
                    } else {
                      badge = "Setup";
                    }
                  } else if (sec.id === "visuals") {
                    badge = coverImage ? "Asset Set" : "Default";
                  } else if (sec.id === "qa") {
                    badge = customQuestions.length > 0 ? `${customQuestions.length} Qs` : "0 Qs";
                  }

                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        setActiveSection(sec.id);
                        setFormError(null);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 border select-none",
                        isActive
                          ? "bg-[#17458F] text-white border-[#17458F] shadow-sm shadow-blue-900/20"
                          : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200/90 hover:text-slate-900"
                      )}
                    >
                      <Icon className={cn("w-3.5 h-3.5", isActive ? "text-[#E78023]" : "text-slate-400")} />
                      <span>{sec.label}</span>
                      {badge && (
                        <span
                          className={cn(
                            "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md leading-none",
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          )}
                        >
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Section Description Bar */}
              <div className="flex items-center justify-between text-slate-500 text-[11px] pt-0.5">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E78023]" />
                  {sections[currentSectionIndex]?.description}
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  Section {currentSectionIndex + 1} of {sections.length}
                </span>
              </div>
            </div>

            {/* Validation Alert */}
            {formError && (
              <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <Info className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Scrollable Form Body */}
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
              
              {/* ========================================================= */}
              {/* 1. DETAILS SECTION                                        */}
              {/* ========================================================= */}
              {activeSection === "details" && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#17458F]" />
                      <span>Title / Headline *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      placeholder={`e.g. ${
                        selectedPillarOption.type === "poll"
                          ? "Vote: Annual Fest Theme 2026"
                          : selectedPillarOption.type === "opportunity"
                          ? "Google Cloud Research Fellowship 2026"
                          : selectedPillarOption.type === "application"
                          ? "SRC Core Technical Committee Recruitment"
                          : selectedPillarOption.type === "submission"
                          ? "Collegiate UI/UX Design Challenge 2026"
                          : "Campus Canteen & Cafeteria Feedback Desk"
                      }`}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F] focus:bg-white transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#17458F]" />
                        <span>Organizing Entity</span>
                      </label>
                      <input
                        type="text"
                        value={organizer}
                        onChange={(e) => setOrganizer(e.target.value)}
                        placeholder="e.g. SRC JDCOEM, GDG Club, NSS Cell"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F] focus:bg-white transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#E78023]" />
                        <span>Deadline (Optional)</span>
                      </label>
                      <input
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F] focus:bg-white transition-all cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Target Audience & Eligibility Switch */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#17458F]" />
                          <span>Target Audience &amp; Eligibility</span>
                        </label>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Visible to everyone publicly. Controls whether participation is campus-exclusive or inter-college.
                        </p>
                      </div>
                      <span className={cn(
                        "text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all",
                        targetAudience === "jdcoem_only"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                      )}>
                        {targetAudience === "jdcoem_only" ? "🎓 JDCOEM Only" : "🌐 Inter-College"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/70 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setTargetAudience("jdcoem_only")}
                        className={cn(
                          "py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                          targetAudience === "jdcoem_only"
                            ? "bg-white text-[#17458F] shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <span>🎓 JDCOEM Students Only</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetAudience("inter_college")}
                        className={cn(
                          "py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                          targetAudience === "inter_college"
                            ? "bg-white text-[#E78023] shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Inter-College (Open to All)</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium italic">
                      {targetAudience === "jdcoem_only"
                        ? "ℹ️ External non-JDCOEM students can view details, but registration & submission will be restricted."
                        : "ℹ️ Open to students and external delegates across all colleges and institutions."}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Brief Summary / Hook *
                    </label>
                    <input
                      type="text"
                      required
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Short 1-line overview displayed on cards and notifications"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F] focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Detailed Guidelines &amp; Context
                    </label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Provide all background information, rules, and expectations..."
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F] focus:bg-white transition-all"
                    />
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* 2. SETUP / PARAMETERS SECTION                             */}
              {/* ========================================================= */}
              {activeSection === "setup" && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  
                  {/* POLL SETUP */}
                  {selectedPillarOption.type === "poll" && (
                    <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                          <Vote className="w-4 h-4 text-[#E78023]" />
                          <span>Poll Choices &amp; Ballot Options</span>
                        </span>
                        <div className="flex items-center gap-3">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-amber-950 select-none">
                            <input
                              type="checkbox"
                              checked={pollAnonymous}
                              onChange={(e) => setPollAnonymous(e.target.checked)}
                              className="rounded text-[#17458F] focus:ring-[#17458F]"
                            />
                            <span>Anonymous Voting</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-amber-950 select-none">
                            <input
                              type="checkbox"
                              checked={pollMultipleChoices}
                              onChange={(e) => setPollMultipleChoices(e.target.checked)}
                              className="rounded text-[#17458F] focus:ring-[#17458F]"
                            />
                            <span>Multi-Choice</span>
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {pollOptions.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 w-6">#{idx + 1}</span>
                            <input
                              type="text"
                              required
                              value={opt}
                              onChange={(e) => {
                                const updated = [...pollOptions];
                                updated[idx] = e.target.value;
                                setPollOptions(updated);
                              }}
                              placeholder={`Option ${idx + 1}`}
                              className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:border-[#17458F]"
                            />
                            {pollOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPollOptions([...pollOptions, `Option ${pollOptions.length + 1}`])}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17458F] hover:underline pt-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Another Option</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* OPPORTUNITY SETUP */}
                  {selectedPillarOption.type === "opportunity" && (
                    <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-4">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-emerald-600" />
                        <span>Opportunity Parameters</span>
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Type
                          </label>
                          <select
                            value={oppRoleType}
                            onChange={(e) => setOppRoleType(e.target.value as any)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold"
                          >
                            <option value="Internship">Internship</option>
                            <option value="Volunteering">Volunteering</option>
                            <option value="Fellowship">Fellowship</option>
                            <option value="Core Committee">Core Committee</option>
                            <option value="Project">Project</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Stipend / Honorarium
                          </label>
                          <input
                            type="text"
                            value={oppStipend}
                            onChange={(e) => setOppStipend(e.target.value)}
                            placeholder="e.g. ₹5,000 / mo or Unpaid"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Duration
                          </label>
                          <input
                            type="text"
                            value={oppDuration}
                            onChange={(e) => setOppDuration(e.target.value)}
                            placeholder="e.g. 3 Months"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Location
                          </label>
                          <select
                            value={oppLocation}
                            onChange={(e) => setOppLocation(e.target.value as any)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold"
                          >
                            <option value="On Campus">On Campus</option>
                            <option value="Remote">Remote</option>
                            <option value="Hybrid">Hybrid</option>
                            <option value="Nagpur">Nagpur</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Available Openings
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={oppOpenings}
                            onChange={(e) => setOppOpenings(Number(e.target.value) || 1)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                          />
                        </div>
                      </div>

                      <div className="pt-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                          Key Perks &amp; Benefits (1 per line)
                        </label>
                        <textarea
                          rows={3}
                          value={oppPerks}
                          onChange={(e) => setOppPerks(e.target.value)}
                          placeholder="Certificate of Excellence&#10;Letter of Recommendation&#10;Direct Council Mentorship"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                        />
                      </div>
                    </div>
                  )}

                  {/* RECRUITMENT / APPLICATION SETUP */}
                  {selectedPillarOption.type === "application" && (
                    <div className="p-5 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-4">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-purple-600" />
                        <span>Recruitment Parameters &amp; Role Setup</span>
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Designated Role Title
                          </label>
                          <input
                            type="text"
                            value={appRole}
                            onChange={(e) => setAppRole(e.target.value)}
                            placeholder="e.g. Technical Coordinator, Graphic Lead"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Recruiting Wing / Committee
                          </label>
                          <input
                            type="text"
                            value={appWing}
                            onChange={(e) => setAppWing(e.target.value)}
                            placeholder="e.g. Media & Documentation, Tech Cell"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Time Commitment
                          </label>
                          <input
                            type="text"
                            value={appCommitment}
                            onChange={(e) => setAppCommitment(e.target.value)}
                            placeholder="e.g. 4-6 Hours / Week"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Prerequisites / Skills
                          </label>
                          <input
                            type="text"
                            value={appPrereqs}
                            onChange={(e) => setAppPrereqs(e.target.value)}
                            placeholder="e.g. Next.js, Figma, or Event Management"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUBMISSION SETUP */}
                  {selectedPillarOption.type === "submission" && (
                    <div className="p-5 rounded-2xl bg-cyan-50/70 border border-cyan-200 space-y-4">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-950 flex items-center gap-1.5">
                        <UploadCloud className="w-4 h-4 text-cyan-600" />
                        <span>Contest Submission Formats &amp; Rules</span>
                      </span>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block mb-2">
                          Allowed File &amp; Deliverable Formats *
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { key: "image" as const, label: "Images (JPG/PNG)", icon: ImageIcon },
                            { key: "pdf" as const, label: "PDF Documents", icon: FileText },
                            { key: "zip" as const, label: "ZIP Archive", icon: FileArchive },
                            { key: "link" as const, label: "External Repo/URL", icon: Link2 },
                          ].map((fmt) => {
                            const isChecked = subAllowedTypes.includes(fmt.key);
                            const FmtIcon = fmt.icon;
                            return (
                              <button
                                key={fmt.key}
                                type="button"
                                onClick={() => toggleSubAllowedType(fmt.key)}
                                className={cn(
                                  "p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer",
                                  isChecked
                                    ? "bg-white border-[#17458F] text-[#17458F] shadow-xs"
                                    : "bg-slate-100/70 border-slate-200 text-slate-500 hover:text-slate-800"
                                )}
                              >
                                <FmtIcon className="w-4 h-4" />
                                <span className="text-[11px]">{fmt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Max File Size Limit (MB)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={subMaxMb}
                            onChange={(e) => setSubMaxMb(Number(e.target.value) || 20)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Evaluation Criteria / Rules (1 per line)
                          </label>
                          <textarea
                            rows={2}
                            value={subRules}
                            onChange={(e) => setSubRules(e.target.value)}
                            placeholder="Originality & Creativity (40%)&#10;Technical Execution (40%)&#10;Documentation (20%)"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GRIEVANCE / ISSUE SETUP */}
                  {selectedPillarOption.type === "issue" && (
                    <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-4">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                        <span>Grievance Desk Security &amp; SLA Setup</span>
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Target Administrative Wing
                          </label>
                          <input
                            type="text"
                            value={issueDept}
                            onChange={(e) => setIssueDept(e.target.value)}
                            placeholder="e.g. Central Campus Amenities, Lab Maintenance"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                            Priority Tier
                          </label>
                          <select
                            value={issuePriority}
                            onChange={(e) => setIssuePriority(e.target.value as any)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold"
                          >
                            <option value="Low">Low (General Feedback)</option>
                            <option value="Medium">Medium (Standard Ticket)</option>
                            <option value="High">High (Needs Rapid Review)</option>
                            <option value="Urgent">Urgent (Safety / Infrastructure Block)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <label className="p-3 rounded-xl bg-white border border-rose-200 flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={issueConfidential}
                            onChange={(e) => setIssueConfidential(e.target.checked)}
                            className="w-4 h-4 rounded text-[#17458F]"
                          />
                          <span>🔒 Encrypted &amp; Confidential (Faculty &amp; Core Only)</span>
                        </label>
                        <label className="p-3 rounded-xl bg-white border border-rose-200 flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={issueAnonymous}
                            onChange={(e) => setIssueAnonymous(e.target.checked)}
                            className="w-4 h-4 rounded text-[#17458F]"
                          />
                          <span>👤 Allow Anonymous Reports</span>
                        </label>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* ========================================================= */}
              {/* 3. VISUAL ASSET SECTION                                   */}
              {/* ========================================================= */}
              {activeSection === "visuals" && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-[#17458F] shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#17458F]">
                        Visual Presentation &amp; Cover Media
                      </h4>
                      <p className="text-slate-600 text-[11px]">
                        Upload a branded banner (16:9 ratio) or choose a campus-themed preset. Uploaded images are compressed into lightweight WebP with zero latency.
                      </p>
                    </div>
                  </div>

                  {/* Dropzone Component */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <ImageUploadDropzone
                      label="Cover Banner (16:9)"
                      sublabel="Displayed on listing cards, discovery hub, and share previews"
                      aspectRatio="16:9"
                      recommendedSize="1200 x 675 px (16:9)"
                      storagePath="listings/covers"
                      previewUrl={coverImage}
                      onUploadStateChange={(isUploading) => {
                        setPendingUploads((prev) => (isUploading ? prev + 1 : Math.max(0, prev - 1)));
                      }}
                      onUrlChange={(url) => {
                        setCoverImage(url);
                      }}
                    />
                  </div>

                  {/* Quick Preset Selector */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                      <span>Or Pick a Quick Preset Cover</span>
                      <span className="text-[10px] text-slate-400 font-normal">Click to apply instantly</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {PRESET_COVERS.map((preset) => {
                        const isSelected = coverImage === preset.url;
                        return (
                          <button
                            key={preset.title}
                            type="button"
                            onClick={() => setCoverImage(preset.url)}
                            className={cn(
                              "group relative rounded-xl overflow-hidden border text-left transition-all cursor-pointer hover:shadow-md",
                              isSelected ? "ring-2 ring-[#17458F] border-transparent" : "border-slate-200"
                            )}
                          >
                            <div className="aspect-video w-full relative bg-slate-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={preset.url}
                                alt={preset.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 p-1 rounded-full bg-[#17458F] text-white shadow-xs">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                            </div>
                            <div className="p-2 bg-white">
                              <p className="text-[11px] font-bold text-slate-900 truncate">
                                {preset.title}
                              </p>
                              <p className="text-[9px] text-slate-500 font-medium">
                                {preset.category}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* 4. Q&A / QUESTIONNAIRE SECTION (All types except poll)     */}
              {/* ========================================================= */}
              {activeSection === "qa" && selectedPillarOption.type !== "poll" && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-start gap-3">
                    <HelpCircle className="w-5 h-5 text-[#E78023] shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                        Custom Inquiry &amp; Intake Questionnaire
                      </h4>
                      <p className="text-amber-900/80 text-[11px]">
                        Add questions for delegates, candidates, or submitters. Responses are collected and exported in the admin console.
                      </p>
                    </div>
                  </div>

                  <CustomQuestionsBuilder
                    questions={customQuestions}
                    onChange={(qs) => setCustomQuestions(qs)}
                  />
                </div>
              )}

            </div>

            {/* Sticky Stepper Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold uppercase tracking-wider hover:bg-slate-100 transition-colors cursor-pointer order-3 sm:order-1"
              >
                Cancel
              </button>

              {/* Stepper Navigation */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-center order-2">
                {prevSection && (
                  <button
                    type="button"
                    onClick={() => handleSectionNav("prev")}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>{prevSection.shortLabel}</span>
                  </button>
                )}

                {nextSection && (
                  <button
                    type="button"
                    onClick={() => handleSectionNav("next")}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 hover:border-[#17458F] bg-white text-slate-700 hover:text-[#17458F] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>Next: {nextSection.shortLabel}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Primary Publish Button */}
              <button
                type="submit"
                disabled={pendingUploads > 0}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer order-1 sm:order-3"
              >
                {pendingUploads > 0 ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Uploading Image ({pendingUploads})...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>{mode === "edit" ? "Save Listing Changes" : `Publish ${selectedPillarOption.title}`}</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}

