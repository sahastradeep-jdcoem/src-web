/*
Utility script to remove the `role` field from the site_content/pillars_of_strength payload in Firestore.

Usage:
  1) Ensure you have a Firebase service account JSON and set GOOGLE_APPLICATION_CREDENTIALS to its path:
       export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
  2) Install firebase-admin locally (only required to run the script):
       npm install firebase-admin
  3) Run the script from the repository root:
       node src/lib/remove-pillar-role.js

Notes:
 - This script DOES NOT commit or export any credentials. Do not check service account files into source control.
 - It updates the document site_content/pillars_of_strength by stripping the `role` property from each item in payload (if present).
 - A write to Firestore will occur — ensure the service account has permissions to read/write Firestore documents in this project.
*/

const admin = require("firebase-admin");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("ERROR: GOOGLE_APPLICATION_CREDENTIALS not set. Point this env var to your service account JSON.");
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
} catch (e) {
  console.warn("firebase-admin initializeApp warning:", e.message || e);
}

const db = admin.firestore();

async function run() {
  const docRef = db.collection("site_content").doc("pillars_of_strength");
  console.log("Fetching document site_content/pillars_of_strength...");
  const snap = await docRef.get();
  if (!snap.exists) {
    console.log("Document does not exist. Nothing to do.");
    return;
  }
  const data = snap.data();
  if (!data || !data.payload) {
    console.log("Document has no payload field. Nothing to do.");
    return;
  }

  const payload = data.payload;
  if (!Array.isArray(payload)) {
    console.log("payload is not an array — printing current payload and aborting.");
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const cleaned = payload.map((item) => {
    if (item && typeof item === "object") {
      const copy = { ...item };
      if (copy.hasOwnProperty("role")) {
        delete copy.role;
      }
      return copy;
    }
    return item;
  });

  console.log("Writing cleaned payload back to Firestore (this will overwrite the payload array)...");
  await docRef.set({ payload: cleaned, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  console.log("Done: removed role field from payload items where present.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
