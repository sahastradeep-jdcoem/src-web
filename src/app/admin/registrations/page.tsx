"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  CheckCircle2, 
  Clock, 
  QrCode, 
  Users, 
  Sparkles,
  Check,
  ShieldCheck,
  Trash2,
  Inbox,
  CreditCard,
  Receipt
} from "lucide-react";
import { RegistrationRecord } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getDepartmentShortName } from "@/lib/departmentsStore";
import { 
  checkInStudentPass, 
  getAllRegistrationsFromFirestore, 
  subscribeToRegistrationsFromFirestore, 
  StudentRegistrationRecord 
} from "@/lib/firebase/firestore";

export default function AdminRegistrationsPage() {
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedRecord, setSelectedRecord] = useState<RegistrationRecord | null>(null);
  const [checkInNotice, setCheckInNotice] = useState<string | null>(null);

  const formatRecords = (records: any[]): RegistrationRecord[] => {
    return records.map((r: any) => ({
      id: r.id,
      registrationId: r.id,
      eventSlug: r.eventId,
      eventName: r.eventTitle || "Event Delegate Pass",
      participantName: r.leaderName,
      email: r.email,
      phone: r.phone,
      department: r.department,
      year: r.year,
      teamType: r.teamSize > 1 ? "Team" : "Individual",
      teamName: r.teamName,
      teamMembers: r.teamMembers ? r.teamMembers.map((m: any) => `${m.name} (${m.btId})`) : r.members?.map((m: any) => m.name),
      registeredAt: r.registeredAt || (r.createdAt ? new Date().toISOString().split("T")[0] : new Date().toISOString().split("T")[0]),
      status: r.status || "CONFIRMED",
      paymentStatus: r.paymentStatus || (r.amountPaid > 0 ? "PAID" : "FREE"),
      paymentId: r.paymentId,
      orderId: r.orderId,
      amountPaid: r.amountPaid || 0,
      ticketCode: `${r.id.slice(0, 7)}-TK`,
      qrPayload: r.qrPayload || `SRC:PASS:${r.id}`,
    }));
  };

  const loadRegistrations = async () => {
    try {
      const localRecords = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
      if (Array.isArray(localRecords) && localRecords.length > 0) {
        setRegistrations(formatRecords(localRecords));
      }
    } catch {}

    try {
      const cloud = await getAllRegistrationsFromFirestore();
      if (cloud && cloud.length > 0) {
        setRegistrations(formatRecords(cloud));
      }
    } catch {}
  };

  useEffect(() => {
    loadRegistrations();

    const unsubscribe = subscribeToRegistrationsFromFirestore((cloudRegs) => {
      if (cloudRegs && cloudRegs.length > 0) {
        setRegistrations(formatRecords(cloudRegs));
      }
    });

    const handleStorage = () => loadRegistrations();
    window.addEventListener("storage", handleStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const handleGateCheckIn = async (record: RegistrationRecord) => {
    await checkInStudentPass(record.registrationId);
    setRegistrations((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, status: "CHECKED_IN" as any } : r))
    );
    if (selectedRecord && selectedRecord.id === record.id) {
      setSelectedRecord({ ...selectedRecord, status: "CHECKED_IN" as any });
    }
    setCheckInNotice(`Verified & Checked-In: ${record.participantName} (${record.registrationId})`);
    setTimeout(() => setCheckInNotice(null), 4000);
  };

  const handleDeleteRegistration = (regId: string, name: string) => {
    if (confirm(`Delete registration record for "${name}" (${regId})?`)) {
      try {
        const localRecords = JSON.parse(localStorage.getItem("src_local_registrations") || "[]");
        const updated = localRecords.filter((r: any) => r.id !== regId);
        localStorage.setItem("src_local_registrations", JSON.stringify(updated));
        loadRegistrations();
      } catch (e) {
        console.error("Error deleting registration", e);
      }
    }
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to delete ALL registrations? This cannot be undone.")) {
      localStorage.removeItem("src_local_registrations");
      setRegistrations([]);
    }
  };

  const filtered = useMemo(() => {
    return registrations.filter((r) => {
      const matchesSearch =
        r.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.registrationId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.department && r.department.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === "All" || r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [registrations, searchQuery, statusFilter]);

  const totalRevenue = useMemo(() => {
    return registrations.reduce((sum, r) => sum + (r.amountPaid || 0), 0);
  }, [registrations]);

  const paidCount = useMemo(() => {
    return registrations.filter((r) => r.paymentStatus === "PAID").length;
  }, [registrations]);

  const checkedInCount = useMemo(() => {
    return registrations.filter((r) => r.status === "CHECKED_IN").length;
  }, [registrations]);

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      alert("No registrations available to export.");
      return;
    }
    const headers = "Registration ID,Participant Name,Email,Phone,Event,Format,Department,Year,Status,Payment Status,Amount Paid (INR),Payment ID,Order ID\n";
    const rows = filtered
      .map(
        (r) =>
          `"${r.registrationId}","${r.participantName}","${r.email}","${r.phone}","${r.eventName}","${r.teamType}","${r.department || ""}","${r.year || ""}","${r.status}","${r.paymentStatus || "FREE"}","${r.amountPaid || 0}","${r.paymentId || "N/A"}","${r.orderId || "N/A"}"`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SRC_Registrations_Ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto text-[#0F172A]">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0F172A] uppercase tracking-tight">
              DELEGATE REGISTRATIONS &amp; REVENUE LEDGER
            </h1>
            <Badge variant="orange" size="sm">
              {registrations.length} LIVE PASSES
            </Badge>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time participant accreditation roster, live QR check-ins, Razorpay payment reconciliation, and CSV export.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {registrations.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Clear All
            </button>
          )}

          <Button
            onClick={handleExportCSV}
            variant="secondary"
            size="md"
            className="gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Finance CSV</span>
          </Button>
        </div>
      </div>

      {checkInNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{checkInNotice}</span>
        </div>
      )}

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
            Total Registrations
          </span>
          <div className="flex items-baseline justify-between">
            <span className="font-heading font-extrabold text-2xl text-[#17458F]">
              {registrations.length}
            </span>
            <span className="text-xs text-slate-500 font-semibold">Passes Issued</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
            Gate Checked-In
          </span>
          <div className="flex items-baseline justify-between">
            <span className="font-heading font-extrabold text-2xl text-emerald-600">
              {checkedInCount}
            </span>
            <span className="text-xs text-emerald-700 font-semibold">
              {registrations.length > 0 ? `${Math.round((checkedInCount / registrations.length) * 100)}% Verified` : "0%"}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
            Total Revenue (Razorpay)
          </span>
          <div className="flex items-baseline justify-between">
            <span className="font-heading font-extrabold text-2xl text-[#E78023]">
              ₹{totalRevenue.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-slate-500 font-semibold">{paidCount} Paid Entries</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
            Complimentary / Free
          </span>
          <div className="flex items-baseline justify-between">
            <span className="font-heading font-extrabold text-2xl text-slate-700">
              {registrations.length - paidCount}
            </span>
            <span className="text-xs text-slate-500 font-semibold">Free Passes</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by participant name, Reg ID, or event..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[#17458F]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <span className="text-xs font-bold text-slate-500 mr-1">Status:</span>
          {["All", "CONFIRMED", "CHECKED_IN", "PENDING"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? "bg-[#E78023] text-white shadow-xs"
                  : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Registrations Data Table */}
      <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
              <Inbox className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-base text-slate-800">
                No Delegate Registrations Found
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {registrations.length === 0
                  ? "No registrations submitted yet. As delegates register for events, their verified accreditation records will appear here."
                  : "No registrations match your current search or filter query."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-4 px-6">Registration ID</th>
                  <th className="py-4 px-6">Participant</th>
                  <th className="py-4 px-6">Event</th>
                  <th className="py-4 px-6">Format / Team</th>
                  <th className="py-4 px-6">Department &amp; Year</th>
                  <th className="py-4 px-6">Payment</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-[#E78023]">
                      {r.registrationId}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900 text-sm">{r.participantName}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{r.email}</div>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-700">
                      {r.eventName}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-medium text-slate-600">
                        {r.teamType === "Team" ? r.teamName || "Team Entry" : "Individual"}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-slate-800 font-medium max-w-xs truncate" title={r.department}>
                        <span className="lg:hidden inline-block px-2 py-0.5 rounded-md bg-slate-100 text-[#17458F] font-mono text-[11px] font-bold">
                          {getDepartmentShortName(r.department)}
                        </span>
                        <span className="hidden lg:inline">
                          {r.department || "—"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">{r.year || "—"}</div>
                    </td>
                    <td className="py-4 px-6">
                      {r.paymentStatus === "PAID" ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CreditCard className="w-3 h-3" />
                            <span>PAID • ₹{r.amountPaid}</span>
                          </span>
                          {r.paymentId && (
                            <span className="block font-mono text-[9px] text-slate-400 truncate max-w-[100px]">
                              {r.paymentId}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <span>FREE PASS</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <Badge
                        variant={r.status === "CHECKED_IN" ? "success" : r.status === "CONFIRMED" ? "orange" : "warning"}
                        size="sm"
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-6 text-right flex items-center justify-end gap-2">
                      {r.status !== "CHECKED_IN" && (
                        <button
                          onClick={() => handleGateCheckIn(r)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
                          title="Mark Gate Check-In"
                        >
                          <Check className="w-3 h-3" />
                          <span>Check In</span>
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedRecord(r)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-[#17458F] transition-colors cursor-pointer"
                        title="Inspect Pass"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRegistration(r.id, r.participantName)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: View Participant QR & Pass Record */}
      {selectedRecord && (
        <Modal
          isOpen={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title="Delegate Record Inspection"
          subtitle={`Registration Code: ${selectedRecord.registrationId}`}
          maxWidth="lg"
        >
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
              <div className="h-28 w-28 mx-auto bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-center">
                <QrCode className="w-full h-full text-[#17458F]" />
              </div>
              <div>
                <span className="font-mono text-xs font-bold text-[#E78023] block">
                  {selectedRecord.ticketCode || `${selectedRecord.registrationId}-TK`}
                </span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  Accreditation Barcode Payload
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1">
                <span className="text-slate-500 uppercase text-[10px] font-bold">Primary Delegate</span>
                <p className="font-bold text-slate-900 text-sm">{selectedRecord.participantName}</p>
                <p className="text-slate-600 text-[11px]">{selectedRecord.email}</p>
                <p className="text-slate-600 text-[11px]">{selectedRecord.phone}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1">
                <span className="text-slate-500 uppercase text-[10px] font-bold">Academic Branch</span>
                <p className="font-bold text-slate-900">{selectedRecord.department || "—"}</p>
                <p className="text-slate-600">{selectedRecord.year || "—"}</p>
                <Badge variant="orange" size="sm" className="mt-1">
                  {selectedRecord.status}
                </Badge>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 space-y-1">
                <span className="text-slate-500 uppercase text-[10px] font-bold">Finance / Gateway</span>
                <p className="font-bold text-slate-900 text-sm">
                  {selectedRecord.paymentStatus === "PAID" ? `₹${selectedRecord.amountPaid || 0}` : "Free Pass"}
                </p>
                <p className="text-[10px] font-mono text-slate-500 truncate" title={selectedRecord.paymentId || "Free"}>
                  ID: {selectedRecord.paymentId || "N/A (Free)"}
                </p>
                {selectedRecord.orderId && (
                  <p className="text-[9px] font-mono text-slate-400 truncate">
                    Ord: {selectedRecord.orderId}
                  </p>
                )}
              </div>
            </div>

            {selectedRecord.teamType === "Team" && selectedRecord.teamMembers && selectedRecord.teamMembers.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-50 space-y-2">
                <span className="text-slate-500 uppercase text-[10px] font-bold block">
                  Team Members ({selectedRecord.teamName || "Squad"})
                </span>
                <ul className="text-xs space-y-1 text-slate-700">
                  {selectedRecord.teamMembers.map((member, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#E78023]" />
                      <span>{member}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                onClick={() => setSelectedRecord(null)}
                variant="outline"
                size="sm"
              >
                Close Inspection
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
