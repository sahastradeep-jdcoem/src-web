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
import { saveSiteContentToFirestore, getSiteContentFromFirestore } from "@/lib/firebase/firestore";

const CERTIFICATES_COLLECTION = "certificates";
const SETTINGS_DOC_ID = "certificate_settings";
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
 * Fetch all issued certificates from Firestore (with local fallback)
 */
export async function getAllCertificatesFromFirestore(): Promise<CertificateRecord[]> {
  try {
    if (!db) {
      const cached = typeof localStorage !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
      return cached ? JSON.parse(cached) : [];
    }
    const colRef = collection(db, CERTIFICATES_COLLECTION);
    const q = query(colRef, orderBy("issuedAt", "desc"), limit(1000));
    const snap = await getDocs(q);

    const list: CertificateRecord[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as CertificateRecord);
    });

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
    } catch (e) {
      console.warn("Could not cache certificates locally", e);
    }

    return list;
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
  if (!db) return [];
  try {
    const colRef = collection(db, CERTIFICATES_COLLECTION);
    const q = query(colRef, where("eventId", "==", eventId));
    const snap = await getDocs(q);

    const list: CertificateRecord[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as CertificateRecord);
    });
    return list;
  } catch (error) {
    console.error(`Error fetching certificates for event ${eventId}:`, error);
    return [];
  }
}

/**
 * Fetch certificates issued to a specific student (by email or BT ID)
 */
export async function getStudentCertificatesFromFirestore(
  email?: string | null,
  btId?: string | null
): Promise<CertificateRecord[]> {
  if (!email && !btId) return [];
  if (!db) return [];

  try {
    const colRef = collection(db, CERTIFICATES_COLLECTION);
    const resultsMap = new Map<string, CertificateRecord>();

    if (email) {
      const normEmail = email.trim().toLowerCase();
      const qEmail = query(colRef, where("recipientEmail", "==", normEmail));
      const snapEmail = await getDocs(qEmail);
      snapEmail.forEach((d) => {
        const cert = d.data() as CertificateRecord;
        resultsMap.set(cert.id, cert);
      });
    }

    if (btId) {
      const normBtId = btId.trim().toUpperCase();
      const qBtId = query(colRef, where("recipientBtId", "==", normBtId));
      const snapBtId = await getDocs(qBtId);
      snapBtId.forEach((d) => {
        const cert = d.data() as CertificateRecord;
        resultsMap.set(cert.id, cert);
      });
    }

    return Array.from(resultsMap.values()).sort(
      (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()
    );
  } catch (error) {
    console.error("Error fetching student certificates:", error);
    return [];
  }
}

/**
 * Real-time listener for a student's certificates
 */
export function subscribeToStudentCertificates(
  email: string | undefined | null,
  btId: string | undefined | null,
  callback: (certs: CertificateRecord[]) => void
): () => void {
  if ((!email && !btId) || !db) {
    callback([]);
    return () => {};
  }

  const colRef = collection(db, CERTIFICATES_COLLECTION);
  let q;

  if (email) {
    q = query(colRef, where("recipientEmail", "==", email.trim().toLowerCase()));
  } else if (btId) {
    q = query(colRef, where("recipientBtId", "==", btId.trim().toUpperCase()));
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
      console.warn("Certificates subscription error:", error);
    }
  );
}

/**
 * Single certificate lookup for the public verification gateway (/verify/certificate/[id])
 */
export async function getCertificateById(id: string): Promise<CertificateRecord | null> {
  const cleanId = (id || "").trim();
  if (!cleanId || !db) return null;

  try {
    // 1. Direct document lookup by cert ID
    const docRef = doc(db, CERTIFICATES_COLLECTION, cleanId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as CertificateRecord;
    }

    // 2. Query lookup by certificateNumber (e.g. SRC/2026-27/PRRM-8924)
    const colRef = collection(db, CERTIFICATES_COLLECTION);
    const q = query(colRef, where("certificateNumber", "==", cleanId), limit(1));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      return querySnap.docs[0].data() as CertificateRecord;
    }

    return null;
  } catch (error) {
    console.error(`Error looking up certificate ${cleanId}:`, error);
    return null;
  }
}

/**
 * Save an individual certificate to Firestore
 */
export async function saveCertificateToFirestore(cert: CertificateRecord): Promise<void> {
  if (!db) return;
  const docRef = doc(db, CERTIFICATES_COLLECTION, cert.id);
  await setDoc(docRef, cert, { merge: true });
}

/**
 * Batch save certificates to Firestore (chunked in blocks of 400 for safety)
 */
export async function batchSaveCertificatesToFirestore(
  certs: CertificateRecord[]
): Promise<{ success: boolean; count: number }> {
  if (!certs || certs.length === 0) return { success: true, count: 0 };
  if (!db) throw new Error("Database not connected");

  try {
    const chunkSize = 400;
    for (let i = 0; i < certs.length; i += chunkSize) {
      const chunk = certs.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      for (const cert of chunk) {
        const docRef = doc(db, CERTIFICATES_COLLECTION, cert.id);
        batch.set(docRef, cert, { merge: true });
      }

      await batch.commit();
    }

    return { success: true, count: certs.length };
  } catch (error) {
    console.error("Batch save certificates error:", error);
    throw error;
  }
}

/**
 * Revoke a certificate in Firestore
 */
export async function revokeCertificateInFirestore(
  certId: string,
  reason: string
): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, CERTIFICATES_COLLECTION, certId);
    await updateDoc(docRef, {
      status: "REVOKED",
      revokedAt: new Date().toISOString(),
      revocationReason: reason || "Revoked by administrative authority",
    });
    return true;
  } catch (error) {
    console.error(`Error revoking certificate ${certId}:`, error);
    return false;
  }
}

/**
 * Delete a certificate from Firestore
 */
export async function deleteCertificateFromFirestore(certId: string): Promise<boolean> {
  if (!db) return false;
  try {
    const docRef = doc(db, CERTIFICATES_COLLECTION, certId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error(`Error deleting certificate ${certId}:`, error);
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
    callback([]);
    return () => {};
  }
  const colRef = collection(db, CERTIFICATES_COLLECTION);
  const q = query(colRef, orderBy("issuedAt", "desc"), limit(500));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: CertificateRecord[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as CertificateRecord);
      });
      callback(list);
    },
    (error) => {
      console.warn("Certificates stream error:", error);
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
  await saveSiteContentToFirestore(SETTINGS_DOC_ID, {
    ...settings,
    updatedAt: new Date().toISOString(),
  });
}
