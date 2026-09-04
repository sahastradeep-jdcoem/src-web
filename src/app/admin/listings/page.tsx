"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { 
  Vote, 
  Briefcase, 
  Users, 
  UploadCloud, 
  ShieldAlert, 
  Calendar, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Eye, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Download, 
  ExternalLink,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Inbox,
  Pencil
} from "lucide-react";
import { 
  getStoredListings, 
  saveStoredListings, 
  subscribeToListings, 
  syncListingsFromFirestore,
  getStoredListingResponses,
  syncListingResponsesFromFirestore,
  subscribeToListingResponses,
  saveStoredListingResponse,
  deleteStoredListingResponse
} from "@/lib/listingsStore";
import { ListingItem, ListingType, ListingPillar, ListingResponseRecord, TargetAudience } from "@/types/listings";
import { CreateListingModal } from "@/components/admin/listings/CreateListingModal";
import { ListingResponsesView } from "@/components/admin/listings/ListingResponsesView";
import { EventFormModal, EventFormData, formatDateToReadable } from "@/components/admin/events/EventFormModal";
import { getStoredEvents, saveStoredEvents, subscribeToEvents } from "@/lib/eventsStore";
import { getStoredClubs } from "@/lib/councilStore";
import { EventItem } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function AdminListingsPage() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [responses, setResponses] = useState<ListingResponseRecord[]>([]);
  const [selectedPillar, setSelectedPillar] = useState<ListingPillar | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [clubsList, setClubsList] = useState<any[]>([]);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  // Inspection Modal for Responses (Applications / Submissions / Grievances / Polls)
  const [inspectingListing, setInspectingListing] = useState<ListingItem | null>(null);
  const [listingToDelete, setListingToDelete] = useState<ListingItem | null>(null);
  const [editingListing, setEditingListing] = useState<ListingItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleUploadStateChange = (uploading: boolean) => {
    setPendingUploads((prev) => Math.max(0, prev + (uploading ? 1 : -1)));
  };

  useEffect(() => {
    setListings(getStoredListings());
    setResponses(getStoredListingResponses());
    setEventsList(getStoredEvents());
    setClubsList(getStoredClubs());

    // CRITICAL: Sync from Firestore on mount to get submissions from other devices
    syncListingsFromFirestore().then((data) => { if (data && Array.isArray(data)) setListings(data); });
    syncListingResponsesFromFirestore().then((data) => { if (data && Array.isArray(data)) setResponses(data); });

    const unsubListings = subscribeToListings((data) => {
      if (data && Array.isArray(data)) setListings(data);
    });

    // CRITICAL: Subscribe to real-time Firestore updates for listing responses
    // so submissions from Sanskruti's laptop (or any device) appear immediately
    const unsubResponses = subscribeToListingResponses((data) => {
      if (data && Array.isArray(data)) setResponses(data);
    });

    const unsubEvents = subscribeToEvents((data) => {
      if (data && Array.isArray(data)) setEventsList(data);
    });

    const handleResponsesUpdate = (e: any) => {
      setResponses(e?.detail || getStoredListingResponses());
    };

    const handleEventsUpdate = () => {
      setEventsList(getStoredEvents());
      setClubsList(getStoredClubs());
    };

    window.addEventListener("src_listing_responses_updated", handleResponsesUpdate);
    window.addEventListener("src_events_updated", handleEventsUpdate);
    window.addEventListener("src_clubs_updated", handleEventsUpdate);
    return () => {
      unsubListings();
      unsubResponses();
      unsubEvents();
      window.removeEventListener("src_listing_responses_updated", handleResponsesUpdate);
      window.removeEventListener("src_events_updated", handleEventsUpdate);
      window.removeEventListener("src_clubs_updated", handleEventsUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const handleCreateEventSubmit = (formData: EventFormData) => {
    const cleanWhatToExpect = Array.from(new Set(formData.whatToExpect.map((s) => s.trim()).filter(Boolean)));
    const cleanRules = Array.from(new Set(formData.rules.map((s) => s.trim()).filter(Boolean)));
    const regDeadlineFormatted = formData.registrationDeadline
      ? formatDateToReadable(formData.registrationDeadline)
      : "TBD";

    const entryFeeText = formData.isPaid
      ? (formData.feePricingModel === "per_team" && formData.teamFeeAmount 
          ? `₹${formData.teamFeeAmount} / team`
          : `₹${formData.feeAmount} / person`)
      : "Free Entry";

    const defaultFallback = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop";
    const primaryPoster = formData.posterImage || formData.cardImage || formData.headerImage || formData.poster || defaultFallback;

    const created: EventItem = {
      id: `evt-${Date.now()}`,
      slug: formData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: formData.name,
      category: formData.category as any,
      date: formData.date || "TBD 2026",
      time: "10:00 AM IST",
      venue: formData.venue,
      organizer: formData.organizer || "SRC JDCOEM",
      organizerClubSlug: formData.organizerClubSlug || (formData.organizer === "SRC JDCOEM" ? "src-council" : undefined),
      status: formData.status,
      poster: primaryPoster,
      cardImage: formData.cardImage || primaryPoster,
      posterImage: formData.posterImage || primaryPoster,
      headerImage: formData.headerImage || formData.cardImage || primaryPoster,
      description: formData.description,
      about: formData.about || formData.description,
      whatToExpect: cleanWhatToExpect.length > 0 ? cleanWhatToExpect : ["High-impact collegiate showcase"],
      rules: cleanRules.length > 0 ? cleanRules : ["College ID mandatory"],
      schedule: [],
      prizes: [],
      teamType: formData.teamType,
      minTeamSize: formData.teamType !== "Individual" ? formData.minTeamSize : undefined,
      maxTeamSize: formData.teamType !== "Individual" ? formData.maxTeamSize : undefined,
      registrationStartDate: formData.registrationStartDate || new Date().toISOString().split("T")[0],
      registrationDeadline: regDeadlineFormatted,
      entryFee: entryFeeText,
      isPaid: formData.isPaid,
      feeAmount: formData.isPaid ? Number(formData.feeAmount) || 0 : 0,
      teamFeeAmount: formData.isPaid && formData.feePricingModel === "per_team" ? Number(formData.teamFeeAmount) || 0 : undefined,
      feePricingModel: formData.isPaid ? formData.feePricingModel : undefined,
      customQuestions: formData.customQuestions && formData.customQuestions.length > 0 ? formData.customQuestions : undefined,
      isParentFest: formData.isParentFest,
      parentEventId: formData.parentEventId || undefined,
      parentEventSlug: formData.parentEventSlug || undefined,
      parentEventName: formData.parentEventName || undefined,
      subEventBadge: formData.subEventBadge || undefined,
      targetAudience: formData.targetAudience || "inter_college",
      isInterCollege: formData.targetAudience === "inter_college",
    };

    const updatedEvents = [created, ...eventsList];
    setEventsList(updatedEvents);
    saveStoredEvents(updatedEvents);

    const newListing: ListingItem = {
      id: `list-${created.id}`,
      slug: created.slug,
      title: created.name,
      pillar: "events",
      type: "event",
      status: created.status === "draft" ? "draft" : "active",
      isLive: created.isLive !== false,
      targetAudience: created.targetAudience || "inter_college",
      isInterCollege: created.isInterCollege !== false,
      summary: created.description || created.name,
      description: created.about || created.description || created.name,
      organizer: created.organizer,
      coverImage: created.cardImage || created.poster || created.headerImage || "",
      deadline: created.registrationDeadline || created.date,
      customQuestions: created.customQuestions,
    };
    const currentListings = getStoredListings();
    const updatedListings = [newListing, ...currentListings.filter((l) => l.slug !== newListing.slug && l.id !== newListing.id)];
    saveStoredListings(updatedListings);
    setListings(updatedListings);

    setIsCreateEventOpen(false);
    showToast(`Event "${created.name}" published successfully.`);
  };

  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      if (selectedPillar !== "all" && item.pillar !== selectedPillar) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q) ||
          item.organizer.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [listings, selectedPillar, searchQuery]);

  // Responses belonging to the actively inspected listing
  const activeListingResponses = useMemo(() => {
    if (!inspectingListing) return [];
    return responses.filter((r) => r.listingId === inspectingListing.id || r.listingSlug === inspectingListing.slug);
  }, [inspectingListing, responses]);

  const handleDeleteListing = (item: ListingItem) => {
    const updated = listings.filter((l) => l.id !== item.id);
    setListings(updated);
    saveStoredListings(updated);
    setListingToDelete(null);
    showToast(`Deleted "${item.title}".`);
  };

  const handleToggleStatus = (item: ListingItem) => {
    const nextStatus = item.status === "active" ? "closed" : "active";
    const updated = listings.map((l) => (l.id === item.id ? { ...l, status: nextStatus } : l));
    setListings(updated as ListingItem[]);
    saveStoredListings(updated as ListingItem[]);
    showToast(`Marked "${item.title}" as ${nextStatus.toUpperCase()}.`);
  };

  const handleToggleAudience = (item: ListingItem) => {
    const nextAudience: TargetAudience = item.targetAudience === "jdcoem_only" ? "inter_college" : "jdcoem_only";
    const updated = listings.map((l) => (l.id === item.id ? { ...l, targetAudience: nextAudience, isInterCollege: nextAudience === "inter_college" } : l));
    setListings(updated as ListingItem[]);
    saveStoredListings(updated as ListingItem[]);
    showToast(`Updated audience for "${item.title}" to ${nextAudience === "inter_college" ? "INTER-COLLEGE" : "JDCOEM ONLY"}.`);
  };

  const handleUpdateResponseStatus = (
    respId: string, 
    newStatus: "approved" | "rejected" | "resolved" | "reviewed"
  ) => {
    const target = responses.find((r) => r.id === respId);
    if (!target) return;

    const updatedRecord: ListingResponseRecord = {
      ...target,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };
    saveStoredListingResponse(updatedRecord);
    setResponses((prev) => prev.map((r) => (r.id === respId ? updatedRecord : r)));
    showToast(`Candidate status updated to ${newStatus.toUpperCase()}`);
  };

  const handleDeleteResponse = (respId: string) => {
    if (!inspectingListing) return;
    deleteStoredListingResponse(respId, inspectingListing.id);
    setResponses((prev) => prev.filter((r) => r.id !== respId));
    showToast("Response record deleted successfully.");
  };

  const handleExportExcel = async () => {
    if (!inspectingListing) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      if (inspectingListing.type === "poll" && inspectingListing.pollConfig) {
        const totalVotes = inspectingListing.pollConfig.totalVotes || 0;
        const sortedOptions = [...inspectingListing.pollConfig.options].sort((a, b) => b.votes - a.votes);
        const pollRows = sortedOptions.map((opt, idx) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          return {
            "Rank": idx + 1,
            "Option Choice": opt.text,
            "Votes Counted": opt.votes,
            "Percentage Share": `${pct}%`,
            "Total Ballots": totalVotes,
            "Status": (inspectingListing.status || "ACTIVE").toUpperCase(),
          };
        });
        const pollWs = XLSX.utils.json_to_sheet(pollRows);
        XLSX.utils.book_append_sheet(wb, pollWs, "Poll Results");
      }

      if (activeListingResponses.length > 0 || inspectingListing.type !== "poll") {
        const exportRows = activeListingResponses.map((r) => {
          const flatRow: Record<string, any> = {
            "Ticket / Ref ID": r.ticketCode || r.id,
            "Candidate Name": r.userName || "Anonymous",
            "Email Address": r.userEmail || "N/A",
            "Department": r.userDepartment || "N/A",
            "Year": r.userYear || "N/A",
            "BT ID": r.btId || "N/A",
            "Status": (r.status || "PENDING").toUpperCase(),
            "Submission Link": r.submissionLink || "N/A",
            "Submitted Date": r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "N/A",
          };

          if (r.answers) {
            Object.entries(r.answers).forEach(([qKey, ansVal]) => {
              const matchedQ = inspectingListing.customQuestions?.find((q) => q.id === qKey);
              const colHeader = matchedQ ? matchedQ.question : `Q: ${qKey}`;
              flatRow[colHeader] = Array.isArray(ansVal)
                ? ansVal.join(", ")
                : typeof ansVal === "object"
                ? JSON.stringify(ansVal)
                : String(ansVal);
            });
          }
          return flatRow;
        });

        const ws = XLSX.utils.json_to_sheet(exportRows);
        XLSX.utils.book_append_sheet(wb, ws, inspectingListing.type === "poll" ? "Voter Log" : "Responses");
      }

      XLSX.writeFile(wb, `${inspectingListing.slug}-report.xlsx`);
      showToast("Excel spreadsheet downloaded successfully.");
    } catch (err) {
      console.error(err);
      showToast("Failed to export Excel spreadsheet.");
    }
  };

  return (
    <div className="space-y-8 font-sans text-left">
      
      {/* Toast Alert */}
      {notice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {inspectingListing ? (
        <ListingResponsesView
          listing={inspectingListing}
          responses={activeListingResponses}
          onBack={() => setInspectingListing(null)}
          onUpdateStatus={handleUpdateResponseStatus}
          onDeleteResponse={handleDeleteResponse}
          onExportExcel={handleExportExcel}
        />
      ) : (
        <>
          {/* Header Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase tracking-tight">
              Engagement &amp; Hub Studio
            </h1>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-[#17458F] tabular-nums text-xs">{listings.length}</span>
              <span className="text-slate-500 font-medium text-xs">Active Listings</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Manage live student polls, club recruitments, fellowships, contest file drives, and confidential grievance desks.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <Link
            href="/hub"
            target="_blank"
            className="h-9 px-3.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:text-[#17458F] text-xs font-medium tracking-normal flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Public Hub</span>
          </Link>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="h-9 px-3.5 sm:px-4 rounded-xl bg-gradient-to-r from-[#17458F] to-[#123670] hover:from-[#123670] hover:to-[#0c2650] text-white text-xs font-semibold tracking-normal transition-all duration-200 shadow-xs hover:shadow-md hover:shadow-[#17458F]/20 active:scale-[0.98] cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/95" />
            <span>+ Create Listing</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Pillar Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "All Items" },
              { id: "voice", label: "📊 Polls" },
              { id: "opportunities", label: "💡 Opportunities" },
              { id: "applications", label: "👥 Recruitments" },
              { id: "submissions", label: "📤 Contests" },
              { id: "community", label: "🐞 Grievances" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedPillar(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  selectedPillar === tab.id
                    ? "bg-[#17458F] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, type, or entity..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#17458F]"
            />
          </div>
        </div>

        {/* Listings Table View */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          {filteredListings.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 mx-auto flex items-center justify-center text-slate-400">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-base text-slate-800">
                No Listings Found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                There are no active student engagement listings matching this category. Click &quot;+ Create Listing&quot; to launch a new engagement primitive.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-6">Listing Title</th>
                  <th className="py-3.5 px-6">Type &amp; Pillar</th>
                  <th className="py-3.5 px-6">Organizing Entity</th>
                  <th className="py-3.5 px-6">Responses / Votes</th>
                  <th className="py-3.5 px-6">Audience</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredListings.map((item) => {
                  const respCount = responses.filter((r) => r.listingId === item.id || r.listingSlug === item.slug).length;
                  const voteCount = item.pollConfig?.totalVotes || 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <span className="font-bold text-slate-900 block text-sm">{item.title}</span>
                        <span className="text-[11px] text-slate-400 line-clamp-1">{item.summary}</span>
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                            {item.type}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-slate-700 font-semibold">
                        {item.organizer}
                      </td>

                      <td className="py-4 px-6">
                        {item.type === "poll" ? (
                          <span className="font-bold text-[#17458F] font-mono">
                            {voteCount} Votes
                          </span>
                        ) : (
                          <span className="font-bold text-slate-700 font-mono">
                            {respCount} Submissions
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        <button
                          type="button"
                          onClick={() => handleToggleAudience(item)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                            item.targetAudience === "jdcoem_only"
                              ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                          }`}
                          title="Click to toggle between JDCOEM Only and Inter-College"
                        >
                          {item.targetAudience === "jdcoem_only" ? "🎓 JDCOEM Only" : "🌐 Inter-College"}
                        </button>
                      </td>

                      <td className="py-4 px-6">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            item.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {item.status}
                        </button>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingListing(item);
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-[#E78023] transition-colors cursor-pointer"
                            title="Edit Listing"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setInspectingListing(item)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#17458F] transition-colors cursor-pointer"
                            title="Inspect Submissions / Votes"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setListingToDelete(item)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                            title="Delete Listing"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      </>
      )}

      {/* CREATE LISTING MODAL */}
      {isCreateModalOpen && (
        <CreateListingModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onOpenEventModal={() => {
            setIsCreateModalOpen(false);
            setIsCreateEventOpen(true);
          }}
          onSuccess={(item) => {
            setListings([item, ...listings]);
            showToast(`Published "${item.title}" successfully.`);
          }}
        />
      )}

      {/* EDIT LISTING MODAL */}
      {isEditModalOpen && editingListing && (
        <CreateListingModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingListing(null);
          }}
          mode="edit"
          initialData={editingListing}
          onSuccess={(updated) => {
            setListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
            showToast(`Listing "${updated.title}" updated successfully.`);
            setIsEditModalOpen(false);
            setEditingListing(null);
          }}
        />
      )}

      {/* CREATE EVENT MODAL (OFFICIAL 5-SECTION EVENT STUDIO) */}
      {isCreateEventOpen && (
        <EventFormModal
          isOpen={isCreateEventOpen}
          onClose={() => setIsCreateEventOpen(false)}
          mode="create"
          eventsList={eventsList}
          clubsList={clubsList}
          onSubmit={handleCreateEventSubmit}
          pendingUploads={pendingUploads}
          onUploadStateChange={handleUploadStateChange}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {listingToDelete && (
        <Modal
          isOpen={!!listingToDelete}
          onClose={() => setListingToDelete(null)}
          title="Delete Listing"
          subtitle="Are you sure you want to remove this engagement listing?"
          maxWidth="md"
        >
          <div className="space-y-6 pt-2">
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">This will permanently remove:</p>
                <p className="font-semibold text-rose-800 text-sm">{listingToDelete.title}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setListingToDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDeleteListing(listingToDelete)}>
                Confirm Deletion
              </Button>
            </div>
          </div>
        </Modal>
      )}


    </div>
  );
}
