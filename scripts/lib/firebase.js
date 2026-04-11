/**
 * Shared Firebase Admin initializer for scripts.
 *
 * Loads .env from the project root and initializes Firebase Admin SDK
 * using FIREBASE_SERVICE_ACCOUNT_BASE64.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const admin = require("firebase-admin");

if (!admin.apps.length) {
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64) {
    console.error("ERROR: FIREBASE_SERVICE_ACCOUNT_BASE64 is not set in .env");
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch (err) {
    console.error("ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:", err.message);
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: serviceAccount.project_id + ".firebasestorage.app",
  });
}

module.exports = admin;
