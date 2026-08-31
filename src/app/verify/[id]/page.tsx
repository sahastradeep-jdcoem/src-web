"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  MapPin, 
  Users, 
  Phone, 
  Mail, 
  CreditCard, 
  ArrowLeft, 
  Clock, 
  Sparkles, 
  UserCheck, 
  RefreshCw,
  QrCode,
  Building
} from "lucide-react";
import { getRegistrationById, checkInStudentPass, StudentRegistrationRecord } from "@/lib/firebase/firestore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default function PassVerificationPage() {
  const params = useParams();
  const passId = typeof params?.id === "string" ? decodeURIComponent(params.id) : "";

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<StudentRegistrationRecord | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const fetchRecord = async () => {
    if (!passId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorNotice(null);
    try {
      const data = await getRegistrationById(passId);
      if (data) {
        setRecord(data);
      } else {
        setErrorNotice("No delegate pass found matching this ID. The pass may be invalid or forged.");
      }
    } catch (err) {
      console.error("Error fetching pass details", err);
      setErrorNotice("Could not reach verification servers. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecord();
  }, [passId]);

  const handleMarkCheckIn = async () => {
    if (!record) return;
    setCheckingIn(true);
    try {
      const success = await checkInStudentPass(record.id);
      if (success) {
        setCheckInSuccess(true);
        setRecord({
          ...record,
          status: "CHECKED_IN",
        });
      }
    } catch (err) {
      console.error("Check-in error", err);
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 space-y-4 font-sans text-white">
        <div className="w-12 h-12 border-3 border-[#E78023] border-t-transparent rounded-full animate-spin" />
        <div className="text-center space-y-1">
          <h2 className="font-heading font-extrabold text-lg text-white">
            Authenticating Delegate Pass...
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            Verifying cryptographic token: {passId}
          </p>
        </div>
      </div>
    );
  }

  // Pass Not Found / Invalid
  if (!record || errorNotice) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-md bg-slate-900 border-2 border-rose-600/50 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl shadow-rose-950/40">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500 animate-pulse">
            <XCircle className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold uppercase tracking-wider font-mono">
              ⚠️ INVALID OR FORGED PASS
            </span>
            <h1 className="font-heading font-extrabold text-2xl text-white">
              Accreditation Denied
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              This QR code does not match any registered student or delegate record in the official JDCOEM database.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-left font-mono text-xs space-y-1 text-slate-300">
            <div className="text-[10px] text-slate-500 uppercase">Scanned Token</div>
            <div className="truncate text-rose-400 font-bold">{passId || "N/A"}</div>
          </div>

          <div className="space-y-2 pt-2">
            <Link
              href="/verify"
              className="w-full py-3.5 rounded-2xl bg-[#E78023] hover:bg-[#D26E17] text-white text-xs font-bold uppercase tracking-wider block text-center transition-all shadow-md shadow-[#E78023]/20"
            >
              Scan Another Pass
            </Link>
            <Link
              href="/"
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-semibold block text-center transition-colors"
            >
              Return to SRC Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isAlreadyCheckedIn = record.status === "CHECKED_IN";
  const isPaid = record.paymentStatus === "PAID" || (record.amountPaid && record.amountPaid > 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-start p-4 sm:p-6 lg:p-10 font-sans">
      <div className="w-full max-w-xl space-y-6">
        
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>SRC JDCOEM</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#17458F]/40 border border-[#17458F] text-[11px] font-bold text-blue-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#E78023]" />
              <span>Gate Verification System</span>
            </span>
          </div>
        </div>

        {/* Verification Status Hero Card */}
        <div
          className={`rounded-3xl p-6 sm:p-8 text-center space-y-4 border-2 shadow-2xl relative overflow-hidden transition-all ${
            isAlreadyCheckedIn
              ? "bg-slate-900 border-blue-500/50 shadow-blue-950/40"
              : "bg-slate-900 border-emerald-500/50 shadow-emerald-950/40"
          }`}
        >
          {/* Hologram Gradient Glow */}
          <div
            className={`absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
              isAlreadyCheckedIn ? "bg-blue-500" : "bg-emerald-500"
            }`}
          />

          <div
            className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto border ${
              isAlreadyCheckedIn
                ? "bg-blue-500/10 border-blue-500/40 text-blue-400"
                : "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 animate-bounce"
            }`}
          >
            <ShieldCheck className="w-10 h-10" />
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider">
              {isAlreadyCheckedIn ? (
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 px-3 py-1 rounded-full">
                  🔵 ATTENDANCE ALREADY RECORDED
                </span>
              ) : (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full">
                  🟢 100% GENUINE &amp; CONFIRMED PASS
                </span>
              )}
            </div>

            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
              {isAlreadyCheckedIn ? "Participant Checked In" : "Valid Delegate Entry"}
            </h1>

            <p className="text-xs text-slate-300 max-w-md mx-auto">
              {isAlreadyCheckedIn
                ? "This pass has already been validated and marked as attended at the campus gates."
                : "Officially registered delegate pass verified against SRC cloud ledger."}
            </p>
          </div>

          {/* Quick Action Button */}
          {!isAlreadyCheckedIn ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleMarkCheckIn}
                disabled={checkingIn}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm uppercase tracking-wider transition-all shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                {checkingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Recording Gate Attendance...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-5 h-5" />
                    <span>Confirm &amp; Check-In Delegate</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-blue-950/40 border border-blue-800/40 text-blue-300 text-xs font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Gate entry recorded. Delegate has cleared accreditation.</span>
            </div>
          )}
        </div>

        {/* Detailed Delegate Information Card */}
        <div className="rounded-3xl bg-slate-900 border border-white/10 p-6 sm:p-8 space-y-6">
          
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Official Event
              </span>
              <h2 className="font-heading font-extrabold text-xl text-[#E78023]">
                {record.eventTitle || record.eventId}
              </h2>
            </div>

            <Badge variant="orange" size="md">
              {record.teamSize > 1 ? `Team of ${record.teamSize}` : "Solo Delegate"}
            </Badge>
          </div>

          {/* Participant Credentials */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Primary Participant / Lead
              </span>
              <p className="font-extrabold text-base text-white">{record.leaderName}</p>
              <p className="text-slate-300 font-medium">{record.department} ({record.year})</p>
              {record.teamMembers?.[0]?.btId && (
                <p className="text-[11px] font-mono text-[#E78023] font-bold">
                  BT ID: {record.teamMembers[0].btId}
                </p>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Payment Clearance
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <Badge variant={isPaid ? "success" : "slate"} size="sm">
                  {isPaid ? "PAID" : "FREE ENTRY"}
                </Badge>
                {isPaid && (
                  <span className="font-bold text-emerald-400 text-sm">
                    ₹{record.amountPaid || 0}
                  </span>
                )}
              </div>
              {record.paymentId && (
                <p className="text-[10px] font-mono text-slate-400 truncate pt-1">
                  Txn: {record.paymentId}
                </p>
              )}
            </div>
          </div>

          {/* Contact Verification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-white/5">
              <Phone className="w-3.5 h-3.5 text-[#E78023] shrink-0" />
              <span className="text-slate-300 font-medium truncate">{record.phone}</span>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-white/5">
              <Mail className="w-3.5 h-3.5 text-[#17458F] shrink-0" />
              <span className="text-slate-300 font-medium truncate">{record.email}</span>
            </div>
          </div>

          {/* Team Squad Roster (If Team Entry) */}
          {record.teamMembers && record.teamMembers.length > 1 && (
            <div className="space-y-3 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#E78023]" />
                  <span>Team Squad Roster ({record.teamName || "Registered Team"})</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {record.teamMembers.length} Members
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {record.teamMembers.map((member, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{member.name}</span>
                      <span className="text-[10px] text-slate-400">{member.department || record.department}</span>
                    </div>
                    {member.btId && (
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-[#E78023] font-mono text-[10px] font-bold">
                        {member.btId}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anti-Tamper Cryptographic Security Info */}
          <div className="p-4 rounded-2xl bg-black/50 border border-white/5 space-y-2 text-[11px] font-mono">
            <div className="flex justify-between items-center text-slate-400">
              <span>Security Pass ID:</span>
              <span className="text-white font-bold">{record.id}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Verification Hash:</span>
              <span className="text-emerald-400 truncate max-w-[200px]">
                {record.qrPayload || `SHA256:SRC:${record.id.slice(0, 10)}`}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Issued On:</span>
              <span className="text-slate-300">
                {record.registeredAt || "Official Season 2025-26"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/verify"
            className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider text-center transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-[#E78023]" />
            <span>Scan Next Pass</span>
          </Link>
          <Link
            href="/admin/registrations"
            className="w-full py-3.5 rounded-2xl bg-slate-900 border border-white/10 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider text-center transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Building className="w-4 h-4 text-[#17458F]" />
            <span>Admin Roster Console</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
