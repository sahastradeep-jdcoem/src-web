"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
  Building,
  User,
  Award,
  Download,
  Share2,
  Printer,
  Copy,
  Check,
  ArrowLeft,
  ExternalLink,
  Ban,
  Sparkles,
} from "lucide-react";
import { CertificateRecord } from "@/types/certificates";
import { getCertificateById, generateLinkedInCertUrl } from "@/lib/certificatesStore";
import { CertificateView } from "@/components/certificates/CertificateView";
import { downloadCertificateAsImage, printCertificate } from "@/lib/certificateExport";
import { Button } from "@/components/ui/Button";

export default function CertificateVerificationPage() {
  const params = useParams();
  const rawId = typeof params?.id === "string" ? decodeURIComponent(params.id) : "";
  const [cert, setCert] = useState<CertificateRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleDownload = async () => {
    if (!cert) return;
    setIsDownloading(true);
    try {
      await downloadCertificateAsImage(
        `public-cert-${cert.id}`,
        `SRC-Verified-Certificate-${cert.recipientName.replace(/\s+/g, "_")}`
      );
    } finally {
      setIsDownloading(false);
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center animate-spin">
            <Award className="w-8 h-8 text-amber-500" />
          </div>
          <div className="space-y-1">
            <h2 className="font-heading font-extrabold text-lg text-white tracking-wide uppercase">
              Verifying Official Credential
            </h2>
            <p className="text-xs text-slate-400 font-medium animate-pulse">
              Querying JDCOEM cryptographic registry for serial: {rawId}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Error / Not Found State
  if (errorNotice || !cert) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex flex-col justify-between p-6 relative overflow-hidden">
        <header className="relative z-10 flex items-center justify-between pb-4 border-b border-slate-800 max-w-4xl mx-auto w-full">
          <Link href="/verify" className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
            Back to Verification Portal
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Verification Unsuccessful
          </span>
        </header>

        <main className="relative z-10 max-w-md mx-auto my-auto text-center space-y-6 py-12">
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

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
            Queried ID: <span className="text-[#E78023] font-bold">{rawId}</span>
          </div>

          <div className="pt-2">
            <Link
              href="/verify"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-[#17458F] hover:bg-[#0f2e60] text-white text-xs font-bold tracking-wide"
            >
              Search Again in Registry
            </Link>
          </div>
        </main>

        <footer className="relative z-10 text-center py-4 text-[11px] text-slate-500 border-t border-slate-800 max-w-4xl mx-auto w-full">
          Jaidev College of Engineering and Management, Nagpur • Student Representation Council
        </footer>
      </div>
    );
  }

  const isRevoked = cert.status === "REVOKED";
  const linkedInUrl = generateLinkedInCertUrl(cert);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP STATUS HEADER */}
      {/* ------------------------------------------------------------- */}
      <header className="relative z-10 max-w-5xl mx-auto w-full pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          href="/verify"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Collegiate Verification Registry
        </Link>

        {/* Verification Status Badge */}
        {isRevoked ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-extrabold uppercase tracking-wide">
            <Ban className="w-3.5 h-3.5" />
            <span>Revoked Credential</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold tracking-wide shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Official Genuine Credential Verified</span>
          </div>
        )}
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN PROVENANCE CARD */}
      {/* ------------------------------------------------------------- */}
      <main className="relative z-10 max-w-5xl mx-auto w-full my-6 space-y-6">
        {/* Verification Metadata Banner */}
        <div className="rounded-3xl bg-slate-800/80 border border-slate-700/80 p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-0.5">
                Authentic Collegiate Credential
              </span>
              <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-white">
                {cert.title}
              </h2>
              <p className="text-xs text-slate-400">
                Issued for {cert.eventName} ({cert.eventDate || "Official Session"})
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyLink}
                className="text-xs border-slate-600 text-slate-200 hover:bg-slate-700"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy Link
                  </>
                )}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => printCertificate()}
                className="text-xs border-slate-600 text-slate-200 hover:bg-slate-700"
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                Print A4
              </Button>

              <Button
                size="sm"
                variant="primary"
                onClick={handleDownload}
                disabled={isDownloading}
                className="text-xs bg-[#17458F] text-white hover:bg-[#0f2e60]"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                {isDownloading ? "Generating..." : "Download 300 DPI PNG"}
              </Button>

              <Link
                href={linkedInUrl}
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-bold transition-all shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Add to LinkedIn
              </Link>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Recipient Name
              </span>
              <p className="font-bold text-white text-sm">{cert.recipientName}</p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                College BT ID
              </span>
              <p className="font-mono font-bold text-[#E78023] text-sm">
                {cert.recipientBtId || "Enrolled Delegate"}
              </p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Certificate Serial
              </span>
              <p className="font-mono font-bold text-slate-200 text-sm">
                {cert.certificateNumber}
              </p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Date of Issuance
              </span>
              <p className="font-semibold text-slate-200 text-sm">{cert.issueDate}</p>
            </div>
          </div>

          {/* Revocation notice if revoked */}
          {isRevoked && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-1">
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
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 3. INTERACTIVE HIGH-RES CERTIFICATE DISPLAY */}
        {/* ------------------------------------------------------------- */}
        <div className="rounded-3xl p-3 sm:p-6 bg-slate-950/60 border border-slate-800 shadow-2xl overflow-x-auto">
          <CertificateView
            id={`public-cert-${cert.id}`}
            certificate={cert}
            className="shadow-2xl"
          />
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* 4. FOOTER */}
      {/* ------------------------------------------------------------- */}
      <footer className="relative z-10 max-w-5xl mx-auto w-full pt-4 border-t border-slate-800 text-center text-xs text-slate-500 space-y-1">
        <p className="font-medium">
          Official Digital Credential Registry • Student Representation Council (Sahastradeep)
        </p>
        <p className="text-[10px] text-slate-600">
          Jaidev College of Engineering and Management, Nagpur • ISO 27001 Cryptographic Verification
        </p>
      </footer>
    </div>
  );
}
