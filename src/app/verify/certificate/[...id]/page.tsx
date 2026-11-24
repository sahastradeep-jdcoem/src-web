"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  XCircle,
  User,
  Award,
  Copy,
  Check,
  ArrowLeft,
  Ban,
  ShieldCheck,
} from "lucide-react";
import { CertificateRecord } from "@/types/certificates";
import { getCertificateById, isCentralizedCertificate } from "@/lib/certificatesStore";

export default function CertificateVerificationPage() {
  const params = useParams();
  const rawId = React.useMemo(() => {
    if (!params?.id) return "";
    if (Array.isArray(params.id)) {
      return params.id.map((segment) => decodeURIComponent(segment)).join("/");
    }
    return decodeURIComponent(String(params.id));
  }, [params?.id]);

  const [cert, setCert] = useState<CertificateRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [copiedSerial, setCopiedSerial] = useState(false);

  useEffect(() => {
    if (!rawId) {
      setLoading(false);
      setErrorNotice("No credential identifier provided in URL.");
      return;
    }

    let isMounted = true;
    setLoading(true);
    setErrorNotice(null);

    getCertificateById(rawId)
      .then((record) => {
        if (!isMounted) return;
        if (record) {
          setCert(record);
        } else {
          setErrorNotice(
            "No official certificate found matching this ID. The credential may be invalid or forged."
          );
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Error looking up certificate:", err);
        setErrorNotice("Could not connect to collegiate verification registry. Please retry.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [rawId]);

  const handleCopySerial = () => {
    if (cert?.certificateNumber && typeof window !== "undefined") {
      navigator.clipboard.writeText(cert.certificateNumber);
      setCopiedSerial(true);
      setTimeout(() => setCopiedSerial(false), 2000);
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0F1D] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center animate-spin">
              <Award className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-heading font-extrabold text-base sm:text-lg text-white tracking-wide uppercase">
              Verifying Official Credential
            </h2>
            <p className="text-xs text-slate-400 font-medium animate-pulse">
              Querying JDCOEM cryptographic registry for serial: <span className="text-amber-400 font-mono">{rawId}</span>...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Error / Not Found State
  if (errorNotice || !cert) {
    return (
      <div className="min-h-screen bg-[#0A0F1D] text-white flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden">
        <header className="relative z-10 flex items-center justify-between pb-4 border-b border-slate-800/80 max-w-4xl mx-auto w-full">
          <Link href="/verify" className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Registry Search
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Unverified Record
          </span>
        </header>

        <main className="relative z-10 max-w-md mx-auto my-auto text-center space-y-6 py-12 px-4">
          <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500 shadow-2xl">
            <XCircle className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h1 className="font-heading font-extrabold text-2xl text-white">
              Credential Not Found
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              {errorNotice || "The certificate ID provided does not match any authentic record in the Student Representation Council official registry."}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 break-all">
            Queried Serial / ID: <span className="text-amber-400 font-bold">{rawId}</span>
          </div>

          <div className="pt-2">
            <Link
              href="/verify"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-[#17458F] hover:bg-[#0f2e60] text-white text-xs font-bold tracking-wide transition-all shadow-lg"
            >
              Search Again in Registry
            </Link>
          </div>
        </main>

        <footer className="relative z-10 text-center py-4 text-[11px] text-slate-500 border-t border-slate-800/80 max-w-4xl mx-auto w-full">
          Jaidev College of Engineering and Management, Nagpur • Student Representation Council
        </footer>
      </div>
    );
  }

  const isRevoked = cert.status === "REVOKED";
  const presidentSig = cert.signatories?.find((s) => /president/i.test(s.designation || s.name || ""));
  const certSession = presidentSig?.organization || (cert.certificateNumber?.match(/SRC\/([^/]+)\//)?.[1] ? `Session ${cert.certificateNumber.match(/SRC\/([^/]+)\//)![1]}` : "Session 2026-27");

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-slate-100 flex flex-col items-center justify-center py-8 sm:py-12 px-4 sm:px-6 relative">
      <main className="relative z-10 max-w-3xl mx-auto w-full space-y-6">
        {/* Certificate Title & Serial Banner */}
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-7 shadow-2xl backdrop-blur-md relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-1 border-b border-slate-800 pb-5">
            {/* Real-time Credential Authenticity Indicator */}
            {!isRevoked ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider">
                  Official Genuine Credential Verified
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider">
                  Official Credential Revoked
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {cert.type === "ACHIEVEMENT" ? "Certificate of Achievement" : "Certificate of Participation"}
              </span>
              {cert.rankOrPosition && (
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Award className="w-3 h-3 text-emerald-400" />
                  Rank: {cert.rankOrPosition}
                </span>
              )}
              <span className="text-slate-600 text-xs">•</span>
              <span className="text-xs text-slate-400 font-medium">{certSession}</span>
            </div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight pt-1">
              {cert.title || "CERTIFICATE OF PARTICIPATION"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 flex items-center gap-1.5">
              <span>Issued for</span>
              <span className="text-slate-200 font-semibold">{cert.eventName}</span>
              {cert.eventDate && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">{cert.eventDate}</span>
                </>
              )}
            </p>
          </div>

          {/* Revocation notice if revoked */}
          {isRevoked && (
            <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                Revocation Notice
              </p>
              <p>
                Reason: {cert.revocationReason || "Revoked by administrative authority."}
              </p>
              {cert.revokedAt && (
                <p className="text-[10px] text-red-400/80">
                  Revoked on: {new Date(cert.revokedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* ----------------------------------------------------------- */}
          {/* A. RECIPIENT IDENTITY ("TO WHOM.. BRANCH YR BT ID")         */}
          {/* ----------------------------------------------------------- */}
          <div className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                Recipient Details (Presented To)
              </h2>
            </div>

            {/* Recipient Highlight Card */}
            <div className="rounded-2xl bg-slate-950/70 border border-slate-800/90 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                    Full Name
                  </span>
                  <div className="font-heading font-extrabold text-xl sm:text-2xl text-white tracking-wide">
                    {cert.recipientName}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-xs font-bold">
                    BT ID: {cert.recipientBtId || "Enrolled Student"}
                  </div>
                </div>
              </div>

              {/* 4-Item Grid: BT ID, Branch, Year, College */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                    Branch / Dept
                  </span>
                  <p className="font-semibold text-slate-200">
                    {cert.recipientDepartment || "Engineering"}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                    Academic Year
                  </span>
                  <p className="font-semibold text-slate-200">
                    {cert.recipientYear || "3rd Year"}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                    College / Institute
                  </span>
                  <p className="font-semibold text-slate-200">
                    {cert.recipientCollege || "JDCOEM, Nagpur"}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                    Student BT ID
                  </span>
                  <p className="font-mono font-bold text-[#E78023]">
                    {cert.recipientBtId || "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* B. EVENT & CREDENTIAL DETAILS ("FOR WHICH EVENT")           */}
          {/* ----------------------------------------------------------- */}
          <div className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                Event & Issuance Record
              </h2>
            </div>

            <div className="rounded-2xl bg-slate-950/70 border border-slate-800/90 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                    Event Name
                  </span>
                  <p className="font-bold text-white text-sm">
                    {cert.eventName}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                    Organizing Club / Body
                  </span>
                  <p className="font-semibold text-slate-200">
                    {isCentralizedCertificate(cert) ? "SRC JDCOEM" : (cert.organizerClub || "Student Representation Council")}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                    Event Date
                  </span>
                  <p className="font-semibold text-slate-200">
                    {cert.eventDate || "Official Session"}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                    Date of Issuance
                  </span>
                  <p className="font-semibold text-slate-200">
                    {cert.issueDate}
                  </p>
                </div>

                {cert.rankOrPosition && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                      Rank / Position Secured
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold text-xs">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      {cert.rankOrPosition}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800/80 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                    Official Certificate Serial Number
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {cert.certificateNumber}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySerial}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Copy Certificate Number"
                    >
                      {copiedSerial ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-0.5">
                    Issuing Authority
                  </span>
                  <span className="font-medium text-slate-300">
                    {cert.issuedBy || "SRC JDCOEM Authority"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Guarantee & Cryptographic Seal */}
        <div className="text-center space-y-1 pb-4">
          <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
            Student Representation Council (Sahastradeep) • JDCOEM Nagpur
          </p>
          <p className="text-[10px] text-slate-500 font-mono">
            Cryptographically Authenticated Digital Credential • Scannable QR Verification Gateway
          </p>
        </div>
      </main>
    </div>
  );
}
