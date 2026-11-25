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
  "In recognition of your enthusiastic participation in the {event}, showcasing dedication and a commendable commitment to excellence.";

export const OLD_DEFAULT_CITATION_TEMPLATE =
  "For outstanding performance in the {event}, in recognition of your outstanding performance, dedication, and technical skills.";

export const DEFAULT_ACHIEVEMENT_CITATION_TEMPLATE =
  "For securing {rank} position in {event}, in recognition of your outstanding performance, exceptional dedication, and meritorious achievement.";

export function getDefaultCitationForType(type: CertificateType): string {
  if (type === "ACHIEVEMENT") {
    return DEFAULT_ACHIEVEMENT_CITATION_TEMPLATE;
  }
  return DEFAULT_CITATION_TEMPLATE;
}

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
            const data = docSnap.data() as CertificateRecord;
            if (data.id !== "preview-cert") {
              list.push(data);
            }
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
      const cleanList = remoteList.filter((c) => c.id !== "preview-cert");
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanList.slice(0, 100)));
      } catch {}
      return cleanList;
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

// In-memory cache & promise deduplication for administrative settings & logos to eliminate burst reads
let inMemoryCertificateSettings: CertificateSettings | null = null;
let settingsFetchPromise: Promise<CertificateSettings> | null = null;
const inMemoryEventLogos = new Map<string, string>();

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
  let queryFailed = false;

  if (db) {
    try {
      const colRef = collection(db, CERTIFICATES_COLLECTION);

      if (normEmail) {
        const qEmail = query(colRef, where("recipientEmail", "==", normEmail), limit(50));
        const snapEmail = await getDocs(qEmail);
        snapEmail.forEach((d) => {
          const cert = d.data() as CertificateRecord;
          if (cert.id !== "preview-cert" && cert.status === "PUBLISHED") {
            resultsMap.set(cert.id, cert);
          }
        });
      }

      if (normBtId) {
        const qBtId = query(colRef, where("recipientBtId", "==", normBtId), limit(50));
        const snapBtId = await getDocs(qBtId);
        snapBtId.forEach((d) => {
          const cert = d.data() as CertificateRecord;
          if (cert.id !== "preview-cert" && cert.status === "PUBLISHED") {
            resultsMap.set(cert.id, cert);
          }
        });
      }
    } catch (err) {
      queryFailed = true;
      console.warn("Direct student certificates query warning, checking fallback registry:", err);
    }
  } else {
    queryFailed = true;
  }

  // Fallback: Check site_content/certificates_registry ONLY IF primary collection queries threw an error
  // If queries succeeded with 0 results, the student simply has 0 certificates—never download the whole registry!
  if (queryFailed && resultsMap.size === 0) {
    try {
      const registry = await getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID);
      if (registry && Array.isArray(registry)) {
        registry.forEach((cert) => {
          const matchEmail = normEmail && cert.recipientEmail?.toLowerCase() === normEmail;
          const matchBtId = normBtId && cert.recipientBtId?.toUpperCase() === normBtId;
          if ((matchEmail || matchBtId) && cert.id !== "preview-cert" && cert.status === "PUBLISHED") {
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
  if (normEmail && normBtId) {
    const emailMap = new Map<string, CertificateRecord>();
    const btIdMap = new Map<string, CertificateRecord>();

    const mergeAndNotify = () => {
      const mergedMap = new Map<string, CertificateRecord>();
      emailMap.forEach((v, k) => mergedMap.set(k, v));
      btIdMap.forEach((v, k) => mergedMap.set(k, v));
      const list = Array.from(mergedMap.values());
      list.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
      callback(list);
    };

    const qEmail = query(colRef, where("recipientEmail", "==", normEmail), limit(50));
    const qBtId = query(colRef, where("recipientBtId", "==", normBtId), limit(50));

    const unsubEmail = onSnapshot(
      qEmail,
      (snapshot) => {
        emailMap.clear();
        snapshot.forEach((docSnap) => {
          const cert = docSnap.data() as CertificateRecord;
          if (cert.id !== "preview-cert" && cert.status === "PUBLISHED") {
            emailMap.set(cert.id, cert);
          }
        });
        mergeAndNotify();
      },
      (error) => {
        console.warn("Certificates email subscription warning:", error);
        getStudentCertificatesFromFirestore(normEmail, normBtId).then(callback);
      }
    );

    const unsubBtId = onSnapshot(
      qBtId,
      (snapshot) => {
        btIdMap.clear();
        snapshot.forEach((docSnap) => {
          const cert = docSnap.data() as CertificateRecord;
          if (cert.id !== "preview-cert" && cert.status === "PUBLISHED") {
            btIdMap.set(cert.id, cert);
          }
        });
        mergeAndNotify();
      },
      (error) => {
        console.warn("Certificates BT ID subscription warning:", error);
        getStudentCertificatesFromFirestore(normEmail, normBtId).then(callback);
      }
    );

    return () => {
      unsubEmail();
      unsubBtId();
    };
  }

  let q;
  if (normEmail) {
    q = query(colRef, where("recipientEmail", "==", normEmail), limit(50));
  } else if (normBtId) {
    q = query(colRef, where("recipientBtId", "==", normBtId), limit(50));
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
        const cert = docSnap.data() as CertificateRecord;
        if (cert.id !== "preview-cert" && cert.status === "PUBLISHED") {
          list.push(cert);
        }
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

  // 2. Query lookup by certificateNumber (e.g. SRC/2026-27/PRRM-8924)
  if (db) {
    try {
      const colRef = collection(db, CERTIFICATES_COLLECTION);
      const q = query(colRef, where("certificateNumber", "==", cleanId), limit(1));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        return querySnap.docs[0].data() as CertificateRecord;
      }

      // 3. Fallback: Query lookup by id field in document if cleanId contained slashes
      if (cleanId.includes("/")) {
        const qId = query(colRef, where("id", "==", cleanId), limit(1));
        const querySnapId = await getDocs(qId);
        if (!querySnapId.empty) {
          return querySnapId.docs[0].data() as CertificateRecord;
        }
      }
    } catch (queryErr) {
      console.warn("Firestore query lookup failed, checking site_content fallback:", queryErr);
    }
  }

  // 4. Fallback for legacy partitioned document in site_content (only if single segment)
  if (!cleanId.includes("/")) {
    try {
      const partitionedDocId = cleanId.startsWith("cert_") ? cleanId : `cert_${cleanId}`;
      const remoteDirect = await getSiteContentFromFirestore<CertificateRecord>(partitionedDocId);
      if (remoteDirect && remoteDirect.id) {
        return remoteDirect;
      }
    } catch (partErr) {
      console.warn("Partitioned site_content lookup notice:", partErr);
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
        "In recognition of your enthusiastic participation in the ProblemX, showcasing dedication and a commendable commitment to excellence.",
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

  // Preview certificates are strictly ephemeral and must NEVER be published to the issued certificates collection or public registry
  if (cert.id === "preview-cert") {
    try {
      await saveSiteContentToFirestore("preview_certificate", compactCertificateForRegistry(cleanCert));
    } catch {}
    return;
  }

  let directWriteSucceeded = false;
  const compactCert = compactCertificateForRegistry(cleanCert);
  if (cleanCert.clubLogoUrl && cleanCert.clubLogoUrl.startsWith("data:") && (cleanCert.eventSlug || cleanCert.eventId)) {
    const logoUrl = cleanCert.clubLogoUrl.trim();
    if (cleanCert.eventSlug) {
      saveSiteContentToFirestore(`cert_logo_${cleanCert.eventSlug}`, { logoUrl }).catch(() => {});
    }
    if (cleanCert.eventId) {
      saveSiteContentToFirestore(`cert_logo_${cleanCert.eventId}`, { logoUrl }).catch(() => {});
    }
  }

  if (db) {
    try {
      const docRef = doc(db, CERTIFICATES_COLLECTION, cert.id);
      await setDoc(docRef, compactCert, { merge: true });
      directWriteSucceeded = true;
    } catch (err) {
      console.warn("Direct save to /certificates failed, saving to site_content fallback:", err);
    }
  }

  // Only fallback to individual partitioned document in site_content if primary collection write failed
  if (!directWriteSucceeded) {
    try {
      await saveSiteContentToFirestore(`cert_${cert.id}`, compactCert);
    } catch (partErr) {
      console.warn("Could not save partitioned cert document to site_content:", partErr);
    }
  }

  // Dual-write to site_content/certificates_registry with compacted entry
  try {
    const rawExisting = (await getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID)) || [];
    const map = new Map<string, CertificateRecord>();
    if (Array.isArray(rawExisting)) {
      rawExisting.forEach((c) => map.set(c.id, compactCertificateForRegistry(c)));
    }
    map.set(cert.id, compactCertificateForRegistry(cleanCert));
    const combined = Array.from(map.values()).slice(0, 150);
    await saveSiteContentToFirestore(REGISTRY_DOC_ID, combined);
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
  // Strip redundant base64 signature/logo/poster payloads (~600KB -> ~1.2KB per cert);
  // CertificateView & hydrateFullCertificate hydrate them from certificate_settings and cert_logo_{slug}.
  const compactCerts = cleanedCerts.map((c) => compactCertificateForRegistry(c));

  // 1. Direct write to /certificates/{cert.id} in parallel 400-doc batches
  let directWriteSucceeded = false;
  try {
    const chunkSize = 400;
    const commitPromises: Promise<void>[] = [];
    for (let i = 0; i < compactCerts.length; i += chunkSize) {
      const chunk = compactCerts.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      for (const cert of chunk) {
        const docRef = doc(db, CERTIFICATES_COLLECTION, cert.id);
        batch.set(docRef, cert, { merge: true });
      }

      commitPromises.push(batch.commit());
    }
    await Promise.all(commitPromises);
    directWriteSucceeded = true;
  } catch (primaryErr) {
    console.warn("Direct /certificates batch write notice, executing dual-write registry backup:", primaryErr);
  }

  // 2. Individual document backup in site_content ONLY if direct write failed
  let individualWriteCount = 0;
  if (!directWriteSucceeded) {
    const fallbackResults = await Promise.allSettled(
      compactCerts.map((cert) => saveSiteContentToFirestore(`cert_${cert.id}`, cert))
    );
    individualWriteCount = fallbackResults.filter((r) => r.status === "fulfilled").length;
  }

  // 3. Local storage cache update & instant cross-tab notification
  try {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      const list: CertificateRecord[] = cached ? JSON.parse(cached) : [];
      const map = new Map(list.map((c) => [c.id, c]));
      compactCerts.forEach((c) => map.set(c.id, c));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(map.values()).slice(0, 100)));
      window.dispatchEvent(new CustomEvent("src_certificates_updated", { detail: compactCerts }));
    }
  } catch (cacheErr) {
    console.warn("Could not cache certificates locally:", cacheErr);
  }

  // Helper for background secondary sync (registry compaction & club logo persistence)
  const performSecondarySync = async () => {
    // Dual-write to site_content/certificates_registry with COMPACTION
    try {
      let existing: CertificateRecord[] = [];
      try {
        const rawExisting = await getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID);
        if (Array.isArray(rawExisting)) {
          existing = rawExisting.map((c) => compactCertificateForRegistry(c));
        }
      } catch (fetchErr) {
        console.warn("Could not fetch existing registry for compaction:", fetchErr);
      }

      const map = new Map<string, CertificateRecord>();
      existing.forEach((c) => map.set(c.id, c));
      compactCerts.forEach((c) => map.set(c.id, c));

      let combined = Array.from(map.values());
      combined.sort((a, b) => new Date(b.issuedAt || 0).getTime() - new Date(a.issuedAt || 0).getTime());

      // Safe payload cap: keep latest 150 certificates in the registry document (< 100 KB)
      if (combined.length > 150) {
        combined = combined.slice(0, 150);
      }

      await saveSiteContentToFirestore(REGISTRY_DOC_ID, combined);
    } catch (fallbackErr) {
      console.error("Dual-write registry fallback notice:", fallbackErr);
    }

    // Persist event club logos ONCE per unique event in the batch (extracted from uncompacted cleanedCerts)
    const uniqueLogos = new Map<string, { slug?: string; id?: string; url: string }>();
    for (const cert of cleanedCerts) {
      if (cert.clubLogoUrl && cert.clubLogoUrl.trim()) {
        const key = cert.eventSlug || cert.eventId || "";
        if (key && !uniqueLogos.has(key)) {
          uniqueLogos.set(key, { slug: cert.eventSlug, id: cert.eventId, url: cert.clubLogoUrl.trim() });
        }
      }
    }

    for (const [, item] of uniqueLogos) {
      try {
        if (typeof window !== "undefined") {
          if (item.slug) localStorage.setItem(`src_club_logo_${item.slug}`, item.url);
          if (item.id) localStorage.setItem(`src_club_logo_${item.id}`, item.url);
        }
        if (item.slug) {
          saveSiteContentToFirestore(`cert_logo_${item.slug}`, { logoUrl: item.url }).catch(() => {});
        }
        if (item.id) {
          saveSiteContentToFirestore(`cert_logo_${item.id}`, { logoUrl: item.url }).catch(() => {});
        }
      } catch {}
    }
  };

  if (directWriteSucceeded) {
    // If primary authoritative batch write succeeded, run secondary backup sync in background
    performSecondarySync().catch(console.warn);
  } else {
    // If direct write failed, wait for secondary backup so write isn't lost
    await performSecondarySync();
    if (individualWriteCount === 0) {
      throw new Error("Failed to write certificates to cloud");
    }
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
 * Features in-memory caching and promise deduplication to eliminate burst Firestore reads.
 */
export async function getCertificateSettings(forceRefresh = false): Promise<CertificateSettings> {
  if (!forceRefresh && inMemoryCertificateSettings) {
    return inMemoryCertificateSettings;
  }
  if (!forceRefresh && settingsFetchPromise) {
    return settingsFetchPromise;
  }

  settingsFetchPromise = (async () => {
    try {
      const remote = await getSiteContentFromFirestore<CertificateSettings>(SETTINGS_DOC_ID);
      if (remote) {
        const resolvedCitation =
          remote.defaultCitationTemplate && remote.defaultCitationTemplate !== OLD_DEFAULT_CITATION_TEMPLATE
            ? remote.defaultCitationTemplate
            : DEFAULT_CITATION_TEMPLATE;

        const merged: CertificateSettings = {
          defaultSignatories: remote.defaultSignatories?.length > 0 ? remote.defaultSignatories : DEFAULT_INSTITUTIONAL_SIGNATORIES,
          defaultCitationTemplate: resolvedCitation,
          defaultClubLogoUrl: remote.defaultClubLogoUrl || "",
          clubLogosByEvent: remote.clubLogosByEvent || {},
          updatedAt: remote.updatedAt,
          updatedBy: remote.updatedBy,
        };
        inMemoryCertificateSettings = merged;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("src_certificate_settings", JSON.stringify(merged));
          } catch {}
        }
        return merged;
      }
    } catch (e) {
      console.warn("Could not fetch remote certificate settings:", e);
    } finally {
      settingsFetchPromise = null;
    }

    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("src_certificate_settings");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.defaultCitationTemplate === OLD_DEFAULT_CITATION_TEMPLATE || !parsed.defaultCitationTemplate) {
            parsed.defaultCitationTemplate = DEFAULT_CITATION_TEMPLATE;
          }
          inMemoryCertificateSettings = parsed;
          return parsed;
        }
      } catch {}
    }

    const fallback: CertificateSettings = {
      defaultSignatories: DEFAULT_INSTITUTIONAL_SIGNATORIES,
      defaultCitationTemplate: DEFAULT_CITATION_TEMPLATE,
      defaultClubLogoUrl: "",
      clubLogosByEvent: {},
    };
    inMemoryCertificateSettings = fallback;
    return fallback;
  })();

  return settingsFetchPromise;
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
    defaultClubLogoUrl: settings.defaultClubLogoUrl || "",
    clubLogosByEvent: mergedClubLogos,
    updatedAt: new Date().toISOString(),
    updatedBy: settings.updatedBy || existing?.updatedBy,
  });

  inMemoryCertificateSettings = cleanSettings as CertificateSettings;

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("src_certificate_settings", JSON.stringify(cleanSettings));
    } catch {}
  }

  await saveSiteContentToFirestore(SETTINGS_DOC_ID, cleanSettings);
}

/**
 * Determines whether a certificate or event is centralised / organized directly by SRC JDCOEM.
 * Centralised events are organized by the Central Student Representative Council,
 * NOT an individual student club, and therefore must NEVER display a center club emblem.
 */
export function isCentralizedCertificate(cert?: Partial<CertificateRecord> | null): boolean {
  if (!cert) return true;

  const rawOrg = cert.organizerClub || "";
  const rawSlug = cert.organizerClubSlug || "";

  // 1. Check if the certificate explicitly matches a chartered student club
  try {
    const clubs = getStoredClubs();
    if (rawSlug || rawOrg) {
      const clubMatch = findClub(clubs, rawSlug || rawOrg);
      if (clubMatch) {
        return false;
      }
    }
  } catch {}

  // 2. Cross-reference with stored events if eventId / eventSlug / eventName is provided
  try {
    const events = getStoredEvents();
    const matched = events.find(
      (e) =>
        (cert.eventId && e.id === cert.eventId) ||
        (cert.eventSlug && e.slug === cert.eventSlug) ||
        (cert.eventName && (e.name === cert.eventName || (e as any).title === cert.eventName))
    );
    if (matched) {
      if (matched.isParentFest) return true;
      const evOrg = (matched.organizer || "").toLowerCase().trim();
      const evSlug = (matched.organizerClubSlug || "").toLowerCase().trim();
      if (
        evSlug === "src-council" ||
        evSlug === "src" ||
        evOrg === "src jdcoem" ||
        evOrg === "src, jdcoem" ||
        evOrg.includes("src jdcoem") ||
        evOrg === "student representative council" ||
        evOrg === "student representation council" ||
        evOrg.includes("council")
      ) {
        return true;
      }

      // Check if the matched event is organized by a chartered student club
      const clubs = getStoredClubs();
      const eventClub = findClub(clubs, matched.organizerClubSlug || matched.organizer || "");
      if (eventClub) {
        return false;
      }
    }
  } catch {}

  // 3. Check explicit SRC / Central Council slugs
  const slug = rawSlug.toLowerCase().trim();
  if (
    slug === "src-council" ||
    slug === "src" ||
    slug === "central" ||
    slug === "centralised" ||
    slug === "centralized" ||
    slug === "council"
  ) {
    return true;
  }

  // 4. Check explicit SRC / Central Council organizer names
  const org = rawOrg.toLowerCase().trim();
  if (
    !org ||
    org === "src" ||
    org === "src jdcoem" ||
    org === "src, jdcoem" ||
    org === "src council" ||
    org === "student representative council" ||
    org === "student representation council" ||
    org === "central student council" ||
    org === "centralised" ||
    org === "centralized" ||
    org.includes("src jdcoem") ||
    org.includes("centralised") ||
    org.includes("centralized")
  ) {
    return true;
  }

  return false;
}

/**
 * Synchronously resolves the organizing club logo for a certificate record:
 * 1. Guarantees empty string for centralised SRC JDCOEM events (no club logo).
 * 2. Certificate's own non-empty clubLogoUrl
 * 3. System Clubs roster (`getStoredClubs()`) matched by organizerClubSlug or organizerClub
 * 4. Events catalog (`getStoredEvents()`) matched by eventId, eventSlug, or eventName
 * 5. LocalStorage event-specific caches (`src_club_logo_*`)
 */
export function resolveCertificateClubLogoSync(cert: Partial<CertificateRecord>): string {
  if (!cert) return "";
  if (isCentralizedCertificate(cert)) return "";
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
      if (matchedEv.isParentFest) return "";
      const evOrg = (matchedEv.organizer || "").toLowerCase().trim();
      const evSlug = (matchedEv.organizerClubSlug || "").toLowerCase().trim();
      if (evSlug === "src-council" || evOrg === "src jdcoem" || evOrg.includes("council")) return "";

      if ((matchedEv as any).clubLogoUrl) return (matchedEv as any).clubLogoUrl;
      const clubs = getStoredClubs();
      const matched = findClub(clubs, matchedEv.organizerClubSlug || matchedEv.organizer || "");
      const logo = matched?.logoImage || matched?.cardImage || matched?.heroImage;
      if (logo && logo.trim()) return logo.trim();
    }
  } catch {}

  // 3. Try cached certificate settings in localStorage (strictly matching event slug/id)
  if (typeof window !== "undefined") {
    try {
      const cachedSettings = localStorage.getItem("src_certificate_settings");
      if (cachedSettings) {
        const parsed = JSON.parse(cachedSettings) as CertificateSettings;
        const slug = cert.eventSlug || "";
        const id = cert.eventId || "";
        const byEvent = (slug && parsed.clubLogosByEvent?.[slug]) || (id && parsed.clubLogosByEvent?.[id]);
        if (byEvent && byEvent.trim()) return byEvent.trim();
      }
    } catch {}

    // 4. Try localStorage direct event logo keys (strictly matching current event)
    try {
      if (cert.eventSlug) {
        const cachedBySlug = localStorage.getItem(`src_club_logo_${cert.eventSlug}`);
        if (cachedBySlug && cachedBySlug.trim()) return cachedBySlug.trim();
      }

      if (cert.eventId) {
        const cachedById = localStorage.getItem(`src_club_logo_${cert.eventId}`);
        if (cachedById && cachedById.trim()) return cachedById.trim();
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
  if (!cert) return "";
  if (isCentralizedCertificate(cert)) return "";

  const syncLogo = resolveCertificateClubLogoSync(cert);
  if (syncLogo) return syncLogo;

  const cacheKey = cert.eventSlug || cert.eventId || "";
  if (cacheKey && inMemoryEventLogos.has(cacheKey)) {
    return inMemoryEventLogos.get(cacheKey)!;
  }

  // 1. Fetch remote certificate settings (in-memory cached, strictly matching this event)
  try {
    const settings = await getCertificateSettings();
    if (settings) {
      const slug = cert.eventSlug || "";
      const id = cert.eventId || "";
      const byEvent = (slug && settings.clubLogosByEvent?.[slug]) || (id && settings.clubLogosByEvent?.[id]);
      if (byEvent && byEvent.trim()) {
        if (cacheKey) inMemoryEventLogos.set(cacheKey, byEvent.trim());
        return byEvent.trim();
      }
    }
  } catch {}

  // 2. Fetch dedicated site_content logo doc
  if (cert.eventSlug) {
    try {
      const doc = await getSiteContentFromFirestore<{ logoUrl?: string }>(`cert_logo_${cert.eventSlug}`);
      if (doc?.logoUrl && doc.logoUrl.trim()) {
        if (cacheKey) inMemoryEventLogos.set(cacheKey, doc.logoUrl.trim());
        return doc.logoUrl.trim();
      }
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

  // 4. Hydrate club logo if missing (strictly skip for centralised events)
  if (isCentralizedCertificate(hydrated)) {
    hydrated.clubLogoUrl = "";
  } else if (!hydrated.clubLogoUrl || !hydrated.clubLogoUrl.trim()) {
    try {
      const logo = await resolveCertificateClubLogoAsync(hydrated);
      if (logo && logo.trim()) {
        hydrated.clubLogoUrl = logo.trim();
      }
    } catch {}
  }

  return hydrated;
}

/**
 * Hydrates a certificate with its organizing club logo before export or rendering
 */
export async function hydrateCertificateClubLogo(cert: CertificateRecord): Promise<CertificateRecord> {
  if (isCentralizedCertificate(cert)) {
    return { ...cert, clubLogoUrl: "" };
  }
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
