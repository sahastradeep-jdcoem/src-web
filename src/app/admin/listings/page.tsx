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
  Inbox
} from "lucide-react";
import { 
  getStoredListings, 
  saveStoredListings, 
  subscribeToListings, 
  getStoredListingResponses,
  saveStoredListingResponse
} from "@/lib/listingsStore";
import { ListingItem, ListingType, ListingPillar, ListingResponseRecord, TargetAudience } from "@/types/listings";
import { CreateListingModal } from "@/components/admin/listings/CreateListingModal";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function AdminListingsPage() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [responses, setResponses] = useState<ListingResponseRecord[]>([]);
  const [selectedPillar, setSelectedPillar] = useState<ListingPillar | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Inspection Modal for Responses (Applications / Submissions / Grievances / Polls)
  const [inspectingListing, setInspectingListing] = useState<ListingItem | null>(null);
  const [listingToDelete, setListingToDelete] = useState<ListingItem | null>(null);

  useEffect(() => {
    setListings(getStoredListings());
    setResponses(getStoredListingResponses());

    const unsubListings = subscribeToListings((data) => {
      if (data && Array.isArray(data)) setListings(data);
    });

    const handleResponsesUpdate = (e: any) => {
      setResponses(e?.detail || getStoredListingResponses());
    };

    window.addEventListener("src_listing_responses_updated", handleResponsesUpdate);
    return () => {
      unsubListings();
      window.removeEventListener("src_listing_responses_updated", handleResponsesUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
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

  const handleExportExcel = async () => {
    if (!inspectingListing) return;
    try {
      const XLSX = await import("xlsx");
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
            flatRow[`Q: ${qKey}`] = typeof ansVal === "object" ? JSON.stringify(ansVal) : String(ansVal);
          });
        }
        return flatRow;
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Responses");
      XLSX.writeFile(wb, `${inspectingListing.slug}-responses.xlsx`);
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

      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E78023]">
              Unified Student Engagement Engine
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {listings.length} Active Listings
            </span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#17458F] uppercase tracking-tight">
            Engagement &amp; Hub Studio
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage live student polls, club recruitments, fellowships, contest file drives, and confidential grievance desks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/hub"
            target="_blank"
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Public Hub</span>
          </Link>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            variant="primary"
            size="sm"
            className="gap-1.5 bg-[#17458F] hover:bg-[#123670]"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Listing</span>
          </Button>
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
                        <div className="flex items-center justify-end gap-2">
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

      {/* CREATE LISTING MODAL */}
      {isCreateModalOpen && (
        <CreateListingModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(item) => {
            setListings([item, ...listings]);
            showToast(`Published "${item.title}" successfully.`);
          }}
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

      {/* INSPECT RESPONSES MODAL (POLL BREAKDOWN OR CANDIDATE APPLICATION ROSTER) */}
      {inspectingListing && (
        <Modal
          isOpen={!!inspectingListing}
          onClose={() => setInspectingListing(null)}
          title={`${inspectingListing.title} — Analytics & Responses`}
          subtitle={`Review candidate submissions, vote percentages, or grievance resolutions.`}
          maxWidth="4xl"
        >
          <div className="space-y-6 pt-2">
            
            {/* Poll Breakdown View */}
            {inspectingListing.type === "poll" && inspectingListing.pollConfig && (
              <div className="space-y-4 p-5 rounded-3xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#17458F]">
                    Live Poll Distribution ({inspectingListing.pollConfig.totalVotes || 0} Total Votes)
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {inspectingListing.pollConfig.isAnonymous ? "Anonymous Voting" : "Verified Student Email"}
                  </span>
                </div>

                <div className="space-y-3">
                  {inspectingListing.pollConfig.options.map((opt) => {
                    const total = inspectingListing.pollConfig?.totalVotes || 0;
                    const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                    return (
                      <div key={opt.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                          <span>{opt.text}</span>
                          <span className="font-mono text-[#17458F]">{pct}% ({opt.votes} votes)</span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-[#17458F] transition-all duration-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Applications / Submissions / Grievance Roster View */}
            {inspectingListing.type !== "poll" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Showing {activeListingResponses.length} Submissions
                  </span>
                  <button
                    type="button"
                    disabled={activeListingResponses.length === 0}
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export to Excel</span>
                  </button>
                </div>

                {activeListingResponses.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-medium">
                    No responses or applications have been submitted for this listing yet.
                  </div>
                ) : (
                  <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
                    {activeListingResponses.map((record) => (
                      <div
                        key={record.id}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-900 text-sm block">
                              {record.userName || "Candidate"}
                            </span>
                            <span className="text-xs text-slate-500">
                              {record.userEmail} • {record.userDepartment} ({record.userYear})
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {record.ticketCode && (
                              <span className="font-mono text-[11px] font-bold text-[#17458F] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {record.ticketCode}
                              </span>
                            )}
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                              {record.status || "RECEIVED"}
                            </span>
                          </div>
                        </div>

                        {/* Submission Link */}
                        {record.submissionLink && (
                          <div className="text-xs">
                            <span className="text-slate-400 font-bold uppercase text-[10px] block">External Portfolio / Entry Link:</span>
                            <a
                              href={record.submissionLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#17458F] font-bold inline-flex items-center gap-1 hover:underline"
                            >
                              <span>{record.submissionLink}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}

                        {/* Dynamic Answers Breakdown */}
                        {record.answers && (
                          <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Candidate Responses
                            </span>
                            {Object.entries(record.answers).map(([key, val]) => (
                              <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                                <span className="text-slate-500 font-medium sm:w-1/3">{key}:</span>
                                <span className="font-semibold text-slate-800 sm:w-2/3">{String(val)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Status Action Buttons */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => handleUpdateResponseStatus(record.id, "approved")}
                            className="px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold transition-colors"
                          >
                            Mark Approved
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateResponseStatus(record.id, "resolved")}
                            className="px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#17458F] text-[11px] font-bold transition-colors"
                          >
                            Mark Resolved
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateResponseStatus(record.id, "rejected")}
                            className="px-3 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end pt-4 border-t border-slate-200">
              <Button variant="outline" size="sm" onClick={() => setInspectingListing(null)}>
                Close Studio
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
