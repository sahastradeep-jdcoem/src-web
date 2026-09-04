"use client";

import React, { useState } from "react";
import { 
  X, 
  Calendar, 
  Users, 
  Vote, 
  Briefcase, 
  UploadCloud, 
  Megaphone, 
  ShieldAlert, 
  ArrowRight, 
  Plus, 
  Trash2, 
  CheckCircle2,
  Sparkles,
  HelpCircle,
  FileText
} from "lucide-react";
import { ListingItem, ListingType, ListingPillar, TargetAudience } from "@/types/listings";
import { CustomQuestionsBuilder } from "@/components/admin/events/CustomQuestionsBuilder";
import { CustomQuestion } from "@/types";
import { saveStoredListings, getStoredListings } from "@/lib/listingsStore";
import { cn } from "@/lib/utils";

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEventModal?: () => void;
  onSuccess?: (item: ListingItem) => void;
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

export function CreateListingModal({
  isOpen,
  onClose,
  onOpenEventModal,
  onSuccess,
}: CreateListingModalProps) {
  const [step, setStep] = useState<"select_type" | "configure_form">("select_type");
  const [selectedPillarOption, setSelectedPillarOption] = useState<PillarOption | null>(null);

  // Universal Config State
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [organizer, setOrganizer] = useState("SRC JDCOEM");
  const [coverImage, setCoverImage] = useState("https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop");
  const [deadline, setDeadline] = useState("");
  const [targetAudience, setTargetAudience] = useState<TargetAudience>("inter_college");
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);

  // Subtype-Specific State
  const [pollOptions, setPollOptions] = useState<string[]>(["Option A", "Option B"]);
  const [pollAnonymous, setPollAnonymous] = useState(false);
  const [oppRoleType, setOppRoleType] = useState<any>("Internship");
  const [oppStipend, setOppStipend] = useState("");
  const [oppDuration, setOppDuration] = useState("");
  const [oppOpenings, setOppOpenings] = useState(2);
  const [oppPerks, setOppPerks] = useState<string>("");
  const [subAllowedTypes, setSubAllowedTypes] = useState<("image" | "pdf" | "link")[]>(["image"]);
  const [issueDept, setIssueDept] = useState("Central Campus Amenities");
  const [issueConfidential, setIssueConfidential] = useState(true);

  if (!isOpen) return null;

  const handleSelectPillar = (option: PillarOption) => {
    if (option.isEventStudio && onOpenEventModal) {
      onClose();
      onOpenEventModal();
      return;
    }
    setSelectedPillarOption(option);
    setStep("configure_form");
  };

  const handleBackToSelect = () => {
    setStep("select_type");
    setSelectedPillarOption(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPillarOption || !title.trim()) return;

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
      organizer,
      coverImage,
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
        totalVotes: 0,
      };
    } else if (selectedPillarOption.type === "opportunity") {
      newListing.opportunityConfig = {
        opportunityType: oppRoleType,
        stipend: oppStipend || undefined,
        duration: oppDuration || undefined,
        openings: Number(oppOpenings) || 1,
        perks: oppPerks ? oppPerks.split("\n").filter((p) => p.trim()) : undefined,
      };
    } else if (selectedPillarOption.type === "submission") {
      newListing.submissionConfig = {
        allowedFileTypes: subAllowedTypes,
        maxFileSizeMB: 20,
      };
    } else if (selectedPillarOption.type === "issue") {
      newListing.issueConfig = {
        targetDepartment: issueDept,
        isConfidential: issueConfidential,
        allowAnonymous: true,
        priorityLevel: "Medium",
      };
    }

    const current = getStoredListings();
    const updated = [newListing, ...current];
    saveStoredListings(updated);

    if (onSuccess) onSuccess(newListing);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-8 font-sans">
        
        {/* Header Strip */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-[#17458F] text-white flex items-center justify-between border-b border-white/10">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#E78023] text-white">
                SRC ENGAGEMENT STUDIO
              </span>
              {step === "configure_form" && selectedPillarOption && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  • {selectedPillarOption.title}
                </span>
              )}
            </div>
            <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-white uppercase tracking-tight">
              {step === "select_type" ? "What would you like to publish?" : `Create ${selectedPillarOption?.title}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: CATEGORY PICKER */}
        {step === "select_type" && (
          <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
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

        {/* STEP 2: DYNAMIC CONFIGURE FORM */}
        {step === "configure_form" && selectedPillarOption && (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <button
                type="button"
                onClick={handleBackToSelect}
                className="text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-[#17458F] flex items-center gap-1.5 transition-colors"
              >
                &larr; Choose Different Type
              </button>
              <span className="text-xs font-bold text-[#E78023] uppercase tracking-wider">
                Publishing to Live Hub
              </span>
            </div>

            {/* Common Top Details */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Title / Headline *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`e.g. ${selectedPillarOption.type === "poll" ? "Vote: Cultural Evening Theme 2026" : "Spring Campus Fellowship Program"}`}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-[#17458F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Organizing Entity
                  </label>
                  <input
                    type="text"
                    value={organizer}
                    onChange={(e) => setOrganizer(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Submission / Voting Deadline (Optional)
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                  />
                </div>
              </div>

              {/* Target Audience & Eligibility Toggle Switch */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#17458F]" />
                      <span>Target Audience &amp; Eligibility</span>
                    </label>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Visible to everyone publicly. Control whether registration is campus-only or open.
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

                {/* Tactile 2-Segment Toggle */}
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
                    <span>🌐 Inter-College (Open to All)</span>
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
                  Brief Summary / Call to Action *
                </label>
                <input
                  type="text"
                  required
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Short 1-line overview displayed on cards and notifications"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Detailed Guidelines / Context
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide all background information, rules, and expectations..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#17458F]"
                />
              </div>
            </div>

            {/* SPECIFIC CONFIGS PER TYPE */}

            {/* 1. POLL CONFIG */}
            {selectedPillarOption.type === "poll" && (
              <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                    <Vote className="w-4 h-4 text-[#E78023]" />
                    <span>Poll Options &amp; Choices</span>
                  </span>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-950">
                    <input
                      type="checkbox"
                      checked={pollAnonymous}
                      onChange={(e) => setPollAnonymous(e.target.checked)}
                      className="rounded text-[#17458F]"
                    />
                    <span>Anonymous Voting</span>
                  </label>
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
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, `Option ${pollOptions.length + 1}`])}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17458F] hover:underline pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Option</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. OPPORTUNITY CONFIG */}
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
              </div>
            )}

            {/* 3. GRIEVANCE / ISSUE CONFIG */}
            {selectedPillarOption.type === "issue" && (
              <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-4">
                <span className="text-xs font-extrabold uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Grievance Desk Setup</span>
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
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="confCheck"
                      checked={issueConfidential}
                      onChange={(e) => setIssueConfidential(e.target.checked)}
                      className="w-4 h-4 rounded text-[#17458F]"
                    />
                    <label htmlFor="confCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Encrypted &amp; Confidential (Faculty &amp; Core Only)
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Universal Custom Questions Builder (Q&N) for Applications, Submissions, Grievances */}
            {selectedPillarOption.type !== "poll" && (
              <div className="pt-2">
                <CustomQuestionsBuilder
                  questions={customQuestions}
                  onChange={(qs) => setCustomQuestions(qs)}
                />
              </div>
            )}

            {/* Actions Bar */}
            <div className="pt-6 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-[#17458F] hover:bg-[#123670] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
              >
                Publish Listing to Live Hub
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
