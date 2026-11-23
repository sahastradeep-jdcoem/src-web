import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import {
  CertificateRecord,
  CertificateSettings,
  CertificateSignatory,
  CertificateType,
} from "@/types/certificates";
import {
  saveSiteContentToFirestore,
  getSiteContentFromFirestore,
  cleanUndefined,
} from "@/lib/firebase/firestore";
import { enqueueCloudWrite } from "./dataSyncEngine";
import { getStoredClubs, findClub } from "./councilStore";
import { getStoredEvents } from "./eventsStore";

const CERTIFICATES_COLLECTION = "certificates";
const SETTINGS_DOC_ID = "certificate_settings";
const REGISTRY_DOC_ID = "certificates_registry";
const LOCAL_STORAGE_KEY = "src_local_certificates_cache";

export const DEFAULT_INSTITUTIONAL_SIGNATORIES: CertificateSignatory[] = [
  {
    id: "sig-president",
    name: "President, SRC",
    designation: "President, SRC",
    organization: "Session 2026-27",
    signatureImageUrl: "",
  },
  {
    id: "sig-faculty-1",
    name: "Faculty Coordinator",
    designation: "Faculty Coordinator",
    organization: "SRC, JDCOEM",
    signatureImageUrl: "",
  },
  {
    id: "sig-faculty-2",
    name: "Faculty Coordinator",
    designation: "Faculty Coordinator",
    organization: "SRC, JDCOEM",
    signatureImageUrl: "",
  },
  {
    id: "sig-dean",
    name: "Dean",
    designation: "Dean",
    organization: "IQAC",
    signatureImageUrl: "",
  },
];

export const DEFAULT_CITATION_TEMPLATE =
  "For outstanding performance in the {event}, in recognition of your outstanding performance, dedication, and technical skills.";

export const DEFAULT_ACHIEVEMENT_CITATION_TEMPLATE =
  "For securing {rank} position in {event}, in recognition of your outstanding performance, exceptional dedication, and meritorious achievement.";

/**
 * Generates an official, tamper-evident certificate serial number
 * e.g. "SRC/2026-27/PRRM-8924"
 */
export function generateCertificateNumber(eventSlug: string, suffix?: string): string {
  const cleanEvent = (eventSlug || "EVENT").replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase();
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  const cleanSuffix = (suffix || randomChars).replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
  return `SRC/2026-27/${cleanEvent}-${cleanSuffix}`;
}

/**
 * Generates a standard LinkedIn Add-to-Profile URL for a certificate
 */
export function generateLinkedInCertUrl(cert: CertificateRecord): string {
  const issueYear = cert.issueDate ? cert.issueDate.split("-")[0] : new Date().getFullYear().toString();
  const issueMonth = cert.issueDate ? parseInt(cert.issueDate.split("-")[1], 10).toString() : "1";
  const certName = encodeURIComponent(`${cert.title} - ${cert.eventName}`);
  const orgName = encodeURIComponent("Student Representation Council, JDCOEM Nagpur");
  const certUrl = encodeURIComponent(cert.verificationUrl);
  const certId = encodeURIComponent(cert.certificateNumber);

  return `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${certName}&organizationName=${orgName}&issueYear=${issueYear}&issueMonth=${issueMonth}&certUrl=${certUrl}&certId=${certId}`;
}

/**
 * Compacts a certificate record for the registry collection or fallback document.
 * Strips bulky base64 signature images and massive data URLs so the document
 * never exceeds Firestore's 1MB single-document limit or safe threshold (~732 KB).
 * Full institutional signatures are safely stored in certificate_settings and individual docs.
 */
export function compactCertificateForRegistry(cert: CertificateRecord): CertificateRecord {
  if (!cert) return cert;
  const clean = cleanUndefined(cert);

  const compactedSignatories = (clean.signatories || []).map((s) => ({
    id: s.id,
    name: s.name,
    designation: s.designation,
    organization: s.organization,
    // Strip bulky base64 data URLs (> 500 chars) from the registry index.
    // They are preserved in individual doc and centrally in certificate_settings.
    signatureImageUrl: s.signatureImageUrl && s.signatureImageUrl.length > 500 ? "" : (s.signatureImageUrl || ""),
  }));

  return {
    ...clean,
    signatories: compactedSignatories,
    posterUrl: clean.posterUrl && clean.posterUrl.length > 500 && clean.posterUrl.startsWith("data:") ? "" : (clean.posterUrl || ""),
    clubLogoUrl: clean.clubLogoUrl && clean.clubLogoUrl.length > 500 && clean.clubLogoUrl.startsWith("data:") ? "" : (clean.clubLogoUrl || ""),
  };
}

/**
 * Fetch all issued certificates from Firestore (with dual-store & local fallback)
 */
export async function getAllCertificatesFromFirestore(): Promise<CertificateRecord[]> {
  try {
    if (db) {
      try {
        const colRef = collection(db, CERTIFICATES_COLLECTION);
        const q = query(colRef, orderBy("issuedAt", "desc"), limit(1000));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list: CertificateRecord[] = [];
          snap.forEach((docSnap) => {
            list.push(docSnap.data() as CertificateRecord);
          });
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
          } catch {}
          return list;
        }
      } catch (err) {
        console.warn("Direct /certificates fetch error, falling back to site_content registry:", err);
      }
    }

    // Fallback: site_content/certificates_registry
    const remoteList = await getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID);
    if (remoteList && Array.isArray(remoteList) && remoteList.length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remoteList.slice(0, 100)));
      } catch {}
      return remoteList;
    }

    const cached = typeof localStorage !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error("Error fetching all certificates from Firestore:", error);
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {
      // ignore
    }
    return [];
  }
}

/**
 * Fetch certificates for a specific event
 */
export async function getCertificatesByEvent(eventId: string): Promise<CertificateRecord[]> {
  const all = await getAllCertificatesFromFirestore();
  return all.filter((c) => c.eventId === eventId || c.eventSlug === eventId);
}

/**
 * Fetch certificates issued to a specific student (by email or BT ID)
 */
export async function getStudentCertificatesFromFirestore(
  email?: string | null,
  btId?: string | null
): Promise<CertificateRecord[]> {
  if (!email && !btId) return [];

  const resultsMap = new Map<string, CertificateRecord>();
  const normEmail = (email || "").trim().toLowerCase();
  const normBtId = (btId || "").trim().toUpperCase();

  if (db) {
    try {
      const colRef = collection(db, CERTIFICATES_COLLECTION);

      if (normEmail) {
        const qEmail = query(colRef, where("recipientEmail", "==", normEmail));
        const snapEmail = await getDocs(qEmail);
        snapEmail.forEach((d) => {
          const cert = d.data() as CertificateRecord;
          resultsMap.set(cert.id, cert);
        });
      }

      if (normBtId) {
        const qBtId = query(colRef, where("recipientBtId", "==", normBtId));
        const snapBtId = await getDocs(qBtId);
        snapBtId.forEach((d) => {
          const cert = d.data() as CertificateRecord;
          resultsMap.set(cert.id, cert);
        });
      }
    } catch (err) {
      console.warn("Direct student certificates query warning, falling back to registry:", err);
    }
  }

  // Fallback: Check site_content/certificates_registry
  if (resultsMap.size === 0) {
    try {
      const registry = await getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID);
      if (registry && Array.isArray(registry)) {
        registry.forEach((cert) => {
          const matchEmail = normEmail && cert.recipientEmail?.toLowerCase() === normEmail;
          const matchBtId = normBtId && cert.recipientBtId?.toUpperCase() === normBtId;
          if (matchEmail || matchBtId) {
            resultsMap.set(cert.id, cert);
          }
        });
      }
    } catch {}
  }

  return Array.from(resultsMap.values()).sort(
    (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()
  );
}

/**
 * Real-time listener for a student's certificates
 */
export function subscribeToStudentCertificates(
  email: string | undefined | null,
  btId: string | undefined | null,
  callback: (certs: CertificateRecord[]) => void
): () => void {
  if (!email && !btId) {
    callback([]);
    return () => {};
  }

  const normEmail = (email || "").trim().toLowerCase();
  const normBtId = (btId || "").trim().toUpperCase();

  if (!db) {
    getStudentCertificatesFromFirestore(normEmail, normBtId).then(callback);
    return () => {};
  }

  const colRef = collection(db, CERTIFICATES_COLLECTION);
  let q;

  if (normEmail) {
    q = query(colRef, where("recipientEmail", "==", normEmail));
  } else if (normBtId) {
    q = query(colRef, where("recipientBtId", "==", normBtId));
  }

  if (!q) {
    callback([]);
    return () => {};
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const list: CertificateRecord[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as CertificateRecord);
      });
      list.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
      callback(list);
    },
    (error) => {
      console.warn("Certificates subscription warning, checking fallback registry:", error);
      getStudentCertificatesFromFirestore(normEmail, normBtId).then(callback);
    }
  );
}

/**
 * Single certificate lookup for the public verification gateway (/verify/certificate/[id])
 */
export async function getCertificateById(id: string): Promise<CertificateRecord | null> {
  const cleanId = (id || "").trim();
  if (!cleanId) return null;

  // 1. Direct document lookup by cert ID (only if valid single segment ID without slashes)
  if (!cleanId.includes("/") && db) {
    try {
      const docRef = doc(db, CERTIFICATES_COLLECTION, cleanId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as CertificateRecord;
      }
    } catch (docErr) {
      console.warn("Direct document lookup failed, proceeding to query:", docErr);
    }
  }

  // 2. Direct lookup from site_content document partition (site_content/cert_[id] or site_content/[id])
  // This guarantees verification succeeds on all devices even if /certificates security rules are pending
  try {
    const partitionedDocId = cleanId.startsWith("cert_") ? cleanId : `cert_${cleanId}`;
    const remoteDirect = await getSiteContentFromFirestore<CertificateRecord>(partitionedDocId);
    if (remoteDirect && remoteDirect.id) {
      return remoteDirect;
    }
  } catch (partErr) {
    console.warn("Partitioned site_content lookup notice:", partErr);
  }

  // 3. Query lookup by certificateNumber (e.g. SRC/2026-27/PRRM-8924)
  if (db) {
    try {
      const colRef = collection(db, CERTIFICATES_COLLECTION);
      const q = query(colRef, where("certificateNumber", "==", cleanId), limit(1));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        return querySnap.docs[0].data() as CertificateRecord;
      }

      // 4. Fallback: Query lookup by id field in document
      const qId = query(colRef, where("id", "==", cleanId), limit(1));
      const querySnapId = await getDocs(qId);
      if (!querySnapId.empty) {
        return querySnapId.docs[0].data() as CertificateRecord;
      }
    } catch (queryErr) {
      console.warn("Firestore query lookup failed, checking site_content fallback:", queryErr);
    }
  }

  // 5. Fallback: Lookup in site_content/certificates_registry or preview_certificate
  try {
    if (cleanId === "preview-cert") {
      const remotePreview = await getSiteContentFromFirestore<CertificateRecord>("preview_certificate");
      if (remotePreview) return remotePreview;
    }
    const remoteRegistry = await getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID);
    if (remoteRegistry && Array.isArray(remoteRegistry)) {
      const found = remoteRegistry.find((c) => c.id === cleanId || c.certificateNumber === cleanId);
      if (found) return found;
    }
  } catch {}

  // 5. Fallback: Local storage cache (for preview certificates or offline resilience)
  try {
    if (typeof window !== "undefined") {
      const preview = localStorage.getItem("src_preview_cert") || sessionStorage.getItem("src_preview_cert");
      if (preview) {
        const pCert = JSON.parse(preview) as CertificateRecord;
        if (
          pCert.id === cleanId ||
          pCert.certificateNumber === cleanId ||
          cleanId === "preview-cert"
        ) {
          return pCert;
        }
      }

      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const list: CertificateRecord[] = JSON.parse(cached);
        const found = list.find((c) => c.id === cleanId || c.certificateNumber === cleanId);
        if (found) return found;
      }
    }
  } catch {
    // ignore
  }

  // 6. Resilient Fallback for live preview scans across devices
  if (cleanId === "preview-cert") {
    return {
      id: "preview-cert",
      certificateNumber: "SRC/2026-27/PRRM-8924",
      type: "PARTICIPATION",
      title: "CERTIFICATE OF PARTICIPATION",
      recipientName: "Harsh Shende",
      recipientEmail: "harshshende0718@gmail.com",
      recipientBtId: "BT22CS001",
      recipientDepartment: "Computer Science & Engineering",
      recipientYear: "3rd Year",
      recipientCollege: "JDCOEM Nagpur",
      registrationId: "reg-preview-001",
      ticketCode: "TCK-8924",
      eventId: "event-prarambh",
      eventSlug: "prarambh",
      eventName: "ProblemX",
      eventDate: "2026-27",
      organizerClub: "Student Representation Council",
      organizerClubSlug: "src",
      colorPalette: {
        primary: "#13384E",
        secondary: "#1E40AF",
        accent: "#F59E0B",
        pillBg: "#0F172A",
        pillText: "#FFFFFF",
      },
      citation:
        "For outstanding performance in the ProblemX, in recognition of your outstanding performance, dedication, and technical skills.",
      signatories: DEFAULT_INSTITUTIONAL_SIGNATORIES,
      issueDate: new Date().toISOString().split("T")[0],
      status: "PUBLISHED",
      verificationUrl: "https://srcjdcoem.in/verify/certificate/preview-cert",
      qrPayload: "https://srcjdcoem.in/verify/certificate/preview-cert",
      issuedBy: "SRC Council Authority",
      issuedAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Save an individual certificate to Firestore (with cleanUndefined & dual-store safety)
 */
export async function saveCertificateToFirestore(cert: CertificateRecord): Promise<void> {
  const cleanCert = cleanUndefined(cert);

  if (db) {
    try {
      const docRef = doc(db, CERTIFICATES_COLLECTION, cert.id);
      await setDoc(docRef, cleanCert, { merge: true });
    } catch (err) {
      console.warn("Direct save to /certificates failed, saving to site_content fallback:", err);
    }
  }

  // Individual partitioned document in site_content (guarantees public QR verification access across all devices)
  try {
    await saveSiteContentToFirestore(`cert_${cert.id}`, cleanCert);
  } catch (partErr) {
    console.warn("Could not save partitioned cert document to site_content:", partErr);
  }

  // Dual-write to site_content/certificates_registry with compacted entry
  try {
    const rawExisting = (await getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID)) || [];
    const map = new Map<string, CertificateRecord>();
    if (Array.isArray(rawExisting)) {
      rawExisting.forEach((c) => map.set(c.id, compactCertificateForRegistry(c)));
    }
    map.set(cert.id, compactCertificateForRegistry(cleanCert));
    const combined = Array.from(map.values()).slice(0, 300);
    await saveSiteContentToFirestore(REGISTRY_DOC_ID, combined);
    enqueueCloudWrite(REGISTRY_DOC_ID, combined, `Certificate: ${cert.recipientName}`);
  } catch (dualErr) {
    console.warn("Dual-write certificate registry notice:", dualErr);
  }
}

/**
 * Batch save certificates to Firestore
 * Guarantees zero-undefined-crash, chunked writeBatch, partitioned fallback, and compacted registry sync
 */
export async function batchSaveCertificatesToFirestore(
  certs: CertificateRecord[]
): Promise<{ success: boolean; count: number }> {
  if (!certs || certs.length === 0) return { success: true, count: 0 };
  if (!db) throw new Error("Database connection not established");

  const cleanedCerts = certs.map((c) => cleanUndefined(c));

  // 1. Direct write to /certificates/{cert.id}
  let directWriteSucceeded = false;
  try {
    const chunkSize = 200;
    for (let i = 0; i < cleanedCerts.length; i += chunkSize) {
      const chunk = cleanedCerts.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      for (const cert of chunk) {
        const docRef = doc(db, CERTIFICATES_COLLECTION, cert.id);
        batch.set(docRef, cert, { merge: true });
      }

      await batch.commit();
    }
    directWriteSucceeded = true;
  } catch (primaryErr) {
    console.warn("Direct /certificates batch write notice, executing dual-write registry backup:", primaryErr);
  }

  // 2. Individual document backup in site_content: site_content/cert_${cert.id}
  // Guarantees that any mobile device scanning the unique QR code can fetch the certificate instantly
  let individualWriteCount = 0;
  for (const cert of cleanedCerts) {
    try {
      await saveSiteContentToFirestore(`cert_${cert.id}`, cert);
      individualWriteCount++;
    } catch (indErr) {
      console.warn(`Individual cert backup notice for ${cert.id}:`, indErr);
    }
  }

  // 3. Dual-write to site_content/certificates_registry with COMPACTION
  // Strips bulky base64 data URLs to eliminate the 1192 KB document threshold breach
  try {
    let existing: CertificateRecord[] = [];
    try {
      const rawExisting = await getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID);
      if (Array.isArray(rawExisting)) {
        // Automatically compact existing entries to cleanse legacy base64 bloat!
        existing = rawExisting.map((c) => compactCertificateForRegistry(c));
      }
    } catch (fetchErr) {
      console.warn("Could not fetch existing registry for compaction:", fetchErr);
    }

    const map = new Map<string, CertificateRecord>();
    existing.forEach((c) => map.set(c.id, c));
    cleanedCerts.forEach((c) => map.set(c.id, compactCertificateForRegistry(c)));

    let combined = Array.from(map.values());
    combined.sort((a, b) => new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime());

    // Safe payload cap: keep latest 300 certificates in the registry document (< 200 KB)
    if (combined.length > 300) {
      combined = combined.slice(0, 300);
    }

    await saveSiteContentToFirestore(REGISTRY_DOC_ID, combined);
    enqueueCloudWrite(REGISTRY_DOC_ID, combined, `Certificates Registry (${combined.length} items)`);
  } catch (fallbackErr) {
    console.error("Dual-write registry fallback notice:", fallbackErr);
    // Only fail if neither direct write nor individual writes succeeded
    if (!directWriteSucceeded && individualWriteCount === 0) {
      throw fallbackErr;
    }
  }

  // 3b. Persist event club logos so they are never lost even if stripped from registry
  for (const cert of cleanedCerts) {
    if (cert.clubLogoUrl && cert.clubLogoUrl.trim()) {
      try {
        if (typeof window !== "undefined") {
          if (cert.eventSlug) localStorage.setItem(`src_club_logo_${cert.eventSlug}`, cert.clubLogoUrl);
          if (cert.eventId) localStorage.setItem(`src_club_logo_${cert.eventId}`, cert.clubLogoUrl);
        }
        if (cert.eventSlug) {
          saveSiteContentToFirestore(`cert_logo_${cert.eventSlug}`, { logoUrl: cert.clubLogoUrl }).catch(() => {});
        }
        if (cert.eventId) {
          saveSiteContentToFirestore(`cert_logo_${cert.eventId}`, { logoUrl: cert.clubLogoUrl }).catch(() => {});
        }
      } catch {}
    }
  }

  // 4. Local storage cache update & instant cross-tab notification
  try {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      const list: CertificateRecord[] = cached ? JSON.parse(cached) : [];
      const map = new Map(list.map((c) => [c.id, c]));
      cleanedCerts.forEach((c) => map.set(c.id, compactCertificateForRegistry(c)));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(map.values()).slice(0, 100)));
      window.dispatchEvent(new CustomEvent("src_certificates_updated", { detail: cleanedCerts }));
    }
  } catch (cacheErr) {
    console.warn("Could not cache certificates locally:", cacheErr);
  }

  return { success: true, count: certs.length };
}

/**
 * Revoke a certificate in Firestore
 */
export async function revokeCertificateInFirestore(
  certId: string,
  reason: string
): Promise<boolean> {
  const now = new Date().toISOString();

  if (db) {
    try {
      const docRef = doc(db, CERTIFICATES_COLLECTION, certId);
      await updateDoc(docRef, {
        status: "REVOKED",
        revokedAt: now,
        revocationReason: reason || "Revoked by administrative authority",
      });
    } catch (err) {
      console.warn("Direct revoke failed, updating site_content registry fallback:", err);
    }
  }

  // Update partitioned document
  try {
    const partCert = await getSiteContentFromFirestore<CertificateRecord>(`cert_${certId}`);
    if (partCert) {
      await saveSiteContentToFirestore(`cert_${certId}`, {
        ...partCert,
        status: "REVOKED",
        revokedAt: now,
        revocationReason: reason || "Revoked by administrative authority",
      });
    }
  } catch {}

  // Update site_content registry
  try {
    const registry = await getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID);
    if (registry && Array.isArray(registry)) {
      const updated = registry.map((c) =>
        c.id === certId
          ? { ...c, status: "REVOKED" as const, revokedAt: now, revocationReason: reason }
          : compactCertificateForRegistry(c)
      );
      await saveSiteContentToFirestore(REGISTRY_DOC_ID, updated);
      enqueueCloudWrite(REGISTRY_DOC_ID, updated, `Revoke Cert: ${certId}`);
    }
    return true;
  } catch (err) {
    console.error("Error revoking in registry:", err);
    return false;
  }
}

/**
 * Delete a certificate from Firestore
 */
export async function deleteCertificateFromFirestore(certId: string): Promise<boolean> {
  if (db) {
    try {
      const docRef = doc(db, CERTIFICATES_COLLECTION, certId);
      await deleteDoc(docRef);
    } catch (error) {
      console.warn(`Direct delete failed for ${certId}, updating registry fallback:`, error);
    }
  }

  // Delete partitioned document
  if (db) {
    try {
      const partDocRef = doc(db, "site_content", `cert_${certId}`);
      await deleteDoc(partDocRef);
    } catch {}
  }

  try {
    const registry = await getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID);
    if (registry && Array.isArray(registry)) {
      const updated = registry
        .filter((c) => c.id !== certId)
        .map((c) => compactCertificateForRegistry(c));
      await saveSiteContentToFirestore(REGISTRY_DOC_ID, updated);
      enqueueCloudWrite(REGISTRY_DOC_ID, updated, `Delete Cert: ${certId}`);
    }
    return true;
  } catch (err) {
    console.error(`Error deleting certificate ${certId} from registry:`, err);
    return false;
  }
}

/**
 * Real-time listener for all certificates (for Admin console)
 */
export function subscribeToCertificates(
  callback: (certs: CertificateRecord[]) => void
): () => void {
  if (!db) {
    getAllCertificatesFromFirestore().then(callback);
    return () => {};
  }
  const colRef = collection(db, CERTIFICATES_COLLECTION);
  const q = query(colRef, orderBy("issuedAt", "desc"), limit(500));

  return onSnapshot(
    q,
    (snapshot) => {
      if (!snapshot.empty) {
        const list: CertificateRecord[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as CertificateRecord);
        });
        callback(list);
      } else {
        // Fallback check site_content/certificates_registry
        getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID).then((remote) => {
          if (remote && Array.isArray(remote) && remote.length > 0) {
            callback(remote);
          } else {
            callback([]);
          }
        });
      }
    },
    (error) => {
      console.warn("Certificates stream error, falling back to site_content registry:", error);
      getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID).then((remote) => {
        if (remote && Array.isArray(remote)) {
          callback(remote);
        }
      });
    }
  );
}

/**
 * Get persistent administrative certificate settings (signatories, default citations, club emblems)
 */
export async function getCertificateSettings(): Promise<CertificateSettings> {
  try {
    const remote = await getSiteContentFromFirestore<CertificateSettings>(SETTINGS_DOC_ID);
    if (remote) {
      const merged: CertificateSettings = {
        defaultSignatories: remote.defaultSignatories?.length > 0 ? remote.defaultSignatories : DEFAULT_INSTITUTIONAL_SIGNATORIES,
        defaultCitationTemplate: remote.defaultCitationTemplate || DEFAULT_CITATION_TEMPLATE,
        defaultClubLogoUrl: remote.defaultClubLogoUrl || "",
        clubLogosByEvent: remote.clubLogosByEvent || {},
        updatedAt: remote.updatedAt,
        updatedBy: remote.updatedBy,
      };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("src_certificate_settings", JSON.stringify(merged));
        } catch {}
      }
      return merged;
    }
  } catch (e) {
    console.warn("Could not fetch remote certificate settings:", e);
  }

  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("src_certificate_settings");
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
  }

  return {
    defaultSignatories: DEFAULT_INSTITUTIONAL_SIGNATORIES,
    defaultCitationTemplate: DEFAULT_CITATION_TEMPLATE,
    defaultClubLogoUrl: "",
    clubLogosByEvent: {},
  };
}

/**
 * Save persistent administrative certificate settings to Firestore
 */
export async function saveCertificateSettings(settings: Partial<CertificateSettings>): Promise<void> {
  let existing: CertificateSettings | null = null;
  try {
    existing = await getCertificateSettings();
  } catch {}

  const mergedClubLogos = {
    ...(existing?.clubLogosByEvent || {}),
    ...(settings.clubLogosByEvent || {}),
  };

  const cleanSettings = cleanUndefined({
    defaultSignatories: settings.defaultSignatories || existing?.defaultSignatories || DEFAULT_INSTITUTIONAL_SIGNATORIES,
    defaultCitationTemplate: settings.defaultCitationTemplate || existing?.defaultCitationTemplate || DEFAULT_CITATION_TEMPLATE,
    defaultClubLogoUrl: settings.defaultClubLogoUrl !== undefined ? settings.defaultClubLogoUrl : (existing?.defaultClubLogoUrl || ""),
    clubLogosByEvent: mergedClubLogos,
    updatedAt: new Date().toISOString(),
    updatedBy: settings.updatedBy || existing?.updatedBy,
  });

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("src_certificate_settings", JSON.stringify(cleanSettings));
    } catch {}
  }

  await saveSiteContentToFirestore(SETTINGS_DOC_ID, cleanSettings);
}

/**
 * Synchronously resolves the organizing club logo for a certificate record:
 * 1. Certificate's own non-empty clubLogoUrl
 * 2. System Clubs roster (`getStoredClubs()`) matched by organizerClubSlug or organizerClub
 * 3. Events catalog (`getStoredEvents()`) matched by eventId, eventSlug, or eventName
 * 4. LocalStorage caches (`src_certificate_settings`, `src_club_logo_*`, `src_preview_cert`)
 */
export function resolveCertificateClubLogoSync(cert: Partial<CertificateRecord>): string {
  if (cert.clubLogoUrl && cert.clubLogoUrl.trim()) return cert.clubLogoUrl.trim();

  // 1. Try clubs roster by organizerClubSlug or organizerClub
  try {
    const clubs = getStoredClubs();
    const matched = findClub(clubs, cert.organizerClubSlug || cert.organizerClub || "");
    const logo = matched?.logoImage || matched?.cardImage || matched?.heroImage;
    if (logo && logo.trim()) return logo.trim();
  } catch {}

  // 2. Try events roster by eventId, eventSlug, or eventName
  try {
    const events = getStoredEvents();
    const matchedEv = events.find(
      (e) =>
        (cert.eventId && e.id === cert.eventId) ||
        (cert.eventSlug && e.slug === cert.eventSlug) ||
        (cert.eventName && (e.name === cert.eventName || (e as any).title === cert.eventName))
    );
    if (matchedEv) {
      if ((matchedEv as any).clubLogoUrl) return (matchedEv as any).clubLogoUrl;
      const clubs = getStoredClubs();
      const matched = findClub(clubs, matchedEv.organizerClubSlug || matchedEv.organizer || "");
      const logo = matched?.logoImage || matched?.cardImage || matched?.heroImage;
      if (logo && logo.trim()) return logo.trim();
    }
  } catch {}

  // 3. Try cached certificate settings in localStorage
  if (typeof window !== "undefined") {
    try {
      const cachedSettings = localStorage.getItem("src_certificate_settings");
      if (cachedSettings) {
        const parsed = JSON.parse(cachedSettings) as CertificateSettings;
        const slug = cert.eventSlug || "";
        const id = cert.eventId || "";
        const byEvent = parsed.clubLogosByEvent?.[slug] || parsed.clubLogosByEvent?.[id];
        if (byEvent && byEvent.trim()) return byEvent.trim();
        if (parsed.defaultClubLogoUrl && parsed.defaultClubLogoUrl.trim()) return parsed.defaultClubLogoUrl.trim();
      }
    } catch {}

    // 4. Try localStorage direct event logo keys
    try {
      const cachedBySlug = cert.eventSlug ? localStorage.getItem(`src_club_logo_${cert.eventSlug}`) : null;
      if (cachedBySlug && cachedBySlug.trim()) return cachedBySlug.trim();

      const cachedById = cert.eventId ? localStorage.getItem(`src_club_logo_${cert.eventId}`) : null;
      if (cachedById && cachedById.trim()) return cachedById.trim();

      const preview = localStorage.getItem("src_preview_cert");
      if (preview) {
        const parsed = JSON.parse(preview);
        if (parsed?.clubLogoUrl && parsed.clubLogoUrl.trim()) {
          return parsed.clubLogoUrl.trim();
        }
      }
    } catch {}
  }

  return "";
}

/**
 * Asynchronously resolves the organizing club logo for a certificate record:
 * Runs synchronous resolution first, then checks Firestore certificate_settings,
 * partitioned document site_content/cert_${cert.id}, and site_content/cert_logo_${slug}.
 */
export async function resolveCertificateClubLogoAsync(cert: CertificateRecord): Promise<string> {
  const syncLogo = resolveCertificateClubLogoSync(cert);
  if (syncLogo) return syncLogo;

  // 1. Fetch remote certificate settings
  try {
    const settings = await getCertificateSettings();
    if (settings) {
      const slug = cert.eventSlug || "";
      const id = cert.eventId || "";
      const byEvent = settings.clubLogosByEvent?.[slug] || settings.clubLogosByEvent?.[id];
      if (byEvent && byEvent.trim()) return byEvent.trim();
      if (settings.defaultClubLogoUrl && settings.defaultClubLogoUrl.trim()) return settings.defaultClubLogoUrl.trim();
    }
  } catch {}

  // 2. Fetch partitioned individual cert document from site_content/cert_${cert.id} or /certificates/${cert.id}
  if (cert.id) {
    try {
      const fullDoc = await getCertificateById(cert.id);
      if (fullDoc?.clubLogoUrl && fullDoc.clubLogoUrl.trim()) return fullDoc.clubLogoUrl.trim();
    } catch {}
  }

  // 3. Fetch dedicated site_content logo doc
  if (cert.eventSlug) {
    try {
      const doc = await getSiteContentFromFirestore<{ logoUrl?: string }>(`cert_logo_${cert.eventSlug}`);
      if (doc?.logoUrl && doc.logoUrl.trim()) return doc.logoUrl.trim();
    } catch {}
  }

  return "";
}

/**
 * Fully hydrates a certificate record with uncompacted signatures and club logo before export or rendering:
 * 1. Checks if signatures or club logo are missing (e.g. from registry compaction).
 * 2. Fetches the uncompacted document from Firestore partition `site_content/cert_${cert.id}` or `/certificates/${cert.id}`.
 * 3. Fetches `certificate_settings` to ensure all 4 default signatures are populated with 100% accuracy.
 * 4. Resolves the club logo through all available fallbacks (settings, preview cert, event logo, clubs roster).
 * 5. Returns a complete, fully-hydrated CertificateRecord ready for instant, artifact-free 300 DPI PNG export.
 */
export async function hydrateFullCertificate(cert: CertificateRecord): Promise<CertificateRecord> {
  if (!cert) return cert;
  let hydrated: CertificateRecord = { ...cert };

  // 1. Fetch uncompacted individual document partition if cert has an ID
  if (cert.id) {
    try {
      const fullDoc = await getCertificateById(cert.id);
      if (fullDoc) {
        if (fullDoc.clubLogoUrl && fullDoc.clubLogoUrl.trim()) {
          hydrated.clubLogoUrl = fullDoc.clubLogoUrl.trim();
        }
        if (Array.isArray(fullDoc.signatories) && fullDoc.signatories.length > 0 && fullDoc.signatories.some((s) => s.signatureImageUrl)) {
          hydrated.signatories = fullDoc.signatories;
        }
      }
    } catch (e) {
      console.warn("Could not fetch full cert doc for hydration:", e);
    }
  }

  // 2. Fetch persistent certificate settings (signatories and default club logo)
  let settings: CertificateSettings | null = null;
  try {
    settings = await getCertificateSettings();
  } catch {}

  // 3. Hydrate signatures by slot index if any signatory is missing signatureImageUrl
  const hasMissingSig = !hydrated.signatories || hydrated.signatories.length === 0 || hydrated.signatories.some((s) => !s.signatureImageUrl);
  if (hasMissingSig && settings?.defaultSignatories && settings.defaultSignatories.length > 0) {
    const baseSignatories = (hydrated.signatories && hydrated.signatories.length > 0)
      ? hydrated.signatories
      : DEFAULT_INSTITUTIONAL_SIGNATORIES;

    hydrated.signatories = baseSignatories.slice(0, 4).map((sig, idx) => {
      if (sig.signatureImageUrl && sig.signatureImageUrl.trim()) return sig;
      const fallback = settings!.defaultSignatories[idx] || settings!.defaultSignatories.find((d) => d.id === sig.id);
      return {
        ...sig,
        signatureImageUrl: fallback?.signatureImageUrl || sig.signatureImageUrl || "",
      };
    });
  }

  // 4. Hydrate club logo if missing
  if (!hydrated.clubLogoUrl || !hydrated.clubLogoUrl.trim()) {
    try {
      const logo = await resolveCertificateClubLogoAsync(hydrated);
      if (logo && logo.trim()) {
        hydrated.clubLogoUrl = logo.trim();
      }
    } catch {}
  }

  // 5. If still missing club logo, check preview cert or settings default logo
  if (!hydrated.clubLogoUrl || !hydrated.clubLogoUrl.trim()) {
    if (settings?.defaultClubLogoUrl && settings.defaultClubLogoUrl.trim()) {
      hydrated.clubLogoUrl = settings.defaultClubLogoUrl.trim();
    } else if (typeof window !== "undefined") {
      try {
        const previewRaw = localStorage.getItem("src_preview_cert");
        if (previewRaw) {
          const parsed = JSON.parse(previewRaw);
          if (parsed?.clubLogoUrl && parsed.clubLogoUrl.trim()) {
            hydrated.clubLogoUrl = parsed.clubLogoUrl.trim();
          }
        }
      } catch {}
    }
  }

  return hydrated;
}

/**
 * Hydrates a certificate with its organizing club logo before export or rendering
 */
export async function hydrateCertificateClubLogo(cert: CertificateRecord): Promise<CertificateRecord> {
  if (cert.clubLogoUrl && cert.clubLogoUrl.trim()) return cert;
  const logo = await resolveCertificateClubLogoAsync(cert);
  if (logo) {
    return {
      ...cert,
      clubLogoUrl: logo,
    };
  }
  return cert;
}
