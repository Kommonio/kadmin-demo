/**
 * Set a user as superadmin by email.
 *
 * Usage:
 *   node scripts/setSuperadmin.js <email>
 *
 * Example:
 *   node scripts/setSuperadmin.js sael@kommon.io
 */

const admin = require("./lib/firebase");

const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

function log(msg, color = "reset") {
  console.log(`${C[color] || ""}${msg}${C.reset}`);
}

async function main() {
  const email = process.argv[2];

  if (!email) {
    log("Usage: node scripts/setSuperadmin.js <email>", "red");
    process.exit(1);
  }

  const db = admin.firestore();

  // Find user by email in Firebase Auth
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
    log(`Found user: ${userRecord.uid} (${userRecord.email})`, "cyan");
  } catch (err) {
    log(`ERROR: User not found for email: ${email}`, "red");
    log(err.message, "red");
    process.exit(1);
  }

  const uid = userRecord.uid;

  // Update Firestore user document
  const userRef = db.collection("Users").doc(uid);
  const userDoc = await userRef.get();

  const updateData = {
    roles: ["admin"],
    activeRole: "admin",
    roleAccess: {
      admin: "superadmin",
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!userDoc.exists) {
    // Create the user document if it doesn't exist
    log(`User document does not exist. Creating...`, "yellow");
    await userRef.set({
      email: userRecord.email,
      displayName: userRecord.displayName || email.split("@")[0],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...updateData,
    });
    log(`Created user document with superadmin access`, "green");
  } else {
    // Merge the update
    await userRef.set(updateData, { merge: true });
    log(`Updated user document with superadmin access`, "green");
  }

  log(`\n✓ ${email} is now a superadmin`, "green");
  process.exit(0);
}

main().catch((err) => {
  log(`FATAL: ${err.message}`, "red");
  process.exit(1);
});
