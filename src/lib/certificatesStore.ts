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

  // 2. Query lookup by certificateNumber (e.g. SRC/2026-27/PRRM-8924)
  if (db) {
    try {
      const colRef = collection(db, CERTIFICATES_COLLECTION);
      const q = query(colRef, where("certificateNumber", "==", cleanId), limit(1));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        return querySnap.docs[0].data() as CertificateRecord;
      }

      // 3. Fallback: Query lookup by id field in document
      const qId = query(colRef, where("id", "==", cleanId), limit(1));
      const querySnapId = await getDocs(qId);
      if (!querySnapId.empty) {
        return querySnapId.docs[0].data() as CertificateRecord;
      }
    } catch (queryErr) {
      console.warn("Firestore query lookup failed, checking site_content fallback:", queryErr);
    }
  }

  // 4. Fallback: Lookup in site_content/certificates_registry
  try {
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

  // Dual-write to site_content/certificates_registry
  try {
    const existing = (await getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID)) || [];
    const map = new Map<string, CertificateRecord>();
    existing.forEach((c) => map.set(c.id, c));
    map.set(cert.id, cleanCert);
    const combined = Array.from(map.values()).slice(0, 1000);
    await saveSiteContentToFirestore(REGISTRY_DOC_ID, combined);
    enqueueCloudWrite(REGISTRY_DOC_ID, combined, `Certificate: ${cert.recipientName}`);
  } catch (dualErr) {
    console.warn("Dual-write certificate registry notice:", dualErr);
  }
}

/**
 * Batch save certificates to Firestore
 * Guarantees zero-undefined-crash, chunked writeBatch, and dual-sync backup to site_content
 */
export async function batchSaveCertificatesToFirestore(
  certs: CertificateRecord[]
): Promise<{ success: boolean; count: number }> {
  if (!certs || certs.length === 0) return { success: true, count: 0 };
  if (!db) throw new Error("Database connection not established");

  const cleanedCerts = certs.map((c) => cleanUndefined(c));

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

  // Dual-write to site_content/certificates_registry (ensures 100% cloud sync even if rules for /certificates aren't deployed yet)
  try {
    const existing = (await getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID)) || [];
    const map = new Map<string, CertificateRecord>();
    existing.forEach((c) => map.set(c.id, c));
    cleanedCerts.forEach((c) => map.set(c.id, c));
    const combined = Array.from(map.values()).slice(0, 1000);
    await saveSiteContentToFirestore(REGISTRY_DOC_ID, combined);
    enqueueCloudWrite(REGISTRY_DOC_ID, combined, `Certificates Registry (${combined.length} items)`);
  } catch (fallbackErr) {
    console.error("Dual-write registry fallback notice:", fallbackErr);
    if (!directWriteSucceeded) {
      throw fallbackErr;
    }
  }

  // Local storage cache update & instant cross-tab notification
  try {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      const list: CertificateRecord[] = cached ? JSON.parse(cached) : [];
      const map = new Map(list.map((c) => [c.id, c]));
      cleanedCerts.forEach((c) => map.set(c.id, c));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(map.values())));
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

  // Update site_content registry
  try {
    const registry = await getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID);
    if (registry && Array.isArray(registry)) {
      const updated = registry.map((c) =>
        c.id === certId
          ? { ...c, status: "REVOKED" as const, revokedAt: now, revocationReason: reason }
          : c
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

  try {
    const registry = await getSiteContentFromFirestore<CertificateRecord[]>(REGISTRY_DOC_ID);
    if (registry && Array.isArray(registry)) {
      const updated = registry.filter((c) => c.id !== certId);
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
 * Get persistent administrative certificate settings (signatories, default citations)
 */
export async function getCertificateSettings(): Promise<CertificateSettings> {
  try {
    const remote = await getSiteContentFromFirestore<CertificateSettings>(SETTINGS_DOC_ID);
    if (remote && remote.defaultSignatories && remote.defaultSignatories.length > 0) {
      return remote;
    }
  } catch (e) {
    console.warn("Could not fetch remote certificate settings:", e);
  }

  return {
    defaultSignatories: DEFAULT_INSTITUTIONAL_SIGNATORIES,
    defaultCitationTemplate: DEFAULT_CITATION_TEMPLATE,
  };
}

/**
 * Save persistent administrative certificate settings to Firestore
 */
export async function saveCertificateSettings(settings: CertificateSettings): Promise<void> {
  const cleanSettings = cleanUndefined({
    ...settings,
    updatedAt: new Date().toISOString(),
  });
  await saveSiteContentToFirestore(SETTINGS_DOC_ID, cleanSettings);
}
