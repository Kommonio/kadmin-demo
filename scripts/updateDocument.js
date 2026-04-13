/**
 * Update fields on an existing Firestore document (merge only).
 *
 * Usage:
 *   node scripts/updateDocument.js <collection> <documentId> --inline '{"field":"value"}'
 *   node scripts/updateDocument.js <collection> <documentId> <jsonFile>
 *
 * Options:
 *   --dry-run  Show what would be written without writing
 *
 * Examples:
 *   node scripts/updateDocument.js Users abc123 --inline '{"adminAccess":"superadmin"}'
 *   node scripts/updateDocument.js Users abc123 data/patches/promote-admin.json
 *   node scripts/updateDocument.js Users abc123 --inline '{"role":"admin","roles":["admin"],"activeRole":"admin","adminAccess":"superadmin","roleAccess":{"admin":"superadmin"}}' --dry-run
 */

const fs = require("fs");
const path = require("path");
const admin = require("./lib/firebase");

const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
};

function log(msg, color = "reset") {
  console.log(`${C[color] || ""}${msg}${C.reset}`);
}

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const dryRun = args.includes("--dry-run");
  const inlineIdx = args.indexOf("--inline");
  const positional = args.filter((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--inline");

  if (positional.length < 2) {
    log("Usage: node scripts/updateDocument.js <collection> <docId> --inline '{...}'", "red");
    log("       node scripts/updateDocument.js <collection> <docId> <jsonFile>", "red");
    log("\nExamples:", "dim");
    log('  node scripts/updateDocument.js Users abc123 --inline \'{"adminAccess":"superadmin"}\'', "dim");
    log('  node scripts/updateDocument.js Users abc123 --inline \'{"role":"admin","roles":["admin"],"activeRole":"admin","adminAccess":"superadmin","roleAccess":{"admin":"superadmin"}}\'', "dim");
    process.exit(1);
  }

  const collection = positional[0];
  const docId = positional[1];

  // Load data from file or inline
  let data;
  if (inlineIdx !== -1 && args[inlineIdx + 1]) {
    try {
      data = JSON.parse(args[inlineIdx + 1]);
    } catch (err) {
      log(`ERROR: Invalid inline JSON: ${err.message}`, "red");
      process.exit(1);
    }
  } else if (positional[2]) {
    const filePath = path.resolve(positional[2]);
    if (!fs.existsSync(filePath)) {
      log(`ERROR: File not found: ${filePath}`, "red");
      process.exit(1);
    }
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
      log(`ERROR: Failed to parse JSON file: ${err.message}`, "red");
      process.exit(1);
    }
  } else {
    log("ERROR: Provide a JSON file path or use --inline '{...}'", "red");
    process.exit(1);
  }

  const db = admin.firestore();

  // Verify document exists
  const docRef = db.collection(collection).doc(docId);
  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    log(`ERROR: Document ${collection}/${docId} does not exist.`, "red");
    log("Use pushDocument.js to create new documents.", "yellow");
    process.exit(1);
  }

  // Add updatedAt timestamp
  data.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  // Show before/after
  const existing = existingDoc.data();
  log(`\n${dryRun ? "[DRY RUN] " : ""}Updating document: ${collection}/${docId}`, "cyan");
  log("", "reset");

  const preview = { ...data };
  delete preview.updatedAt;
  for (const [key, value] of Object.entries(preview)) {
    const oldVal = existing[key];
    const oldStr = oldVal === undefined ? "(not set)" : JSON.stringify(oldVal);
    const newStr = JSON.stringify(value);
    log(`  ${key}: ${oldStr} → ${newStr}`, oldStr === newStr ? "dim" : "yellow");
  }

  if (dryRun) {
    log("\n[DRY RUN] No changes written.", "yellow");
    process.exit(0);
  }

  await docRef.update(data);
  log(`\nDocument ${collection}/${docId} updated successfully.`, "green");
  process.exit(0);
}

main().catch((err) => {
  log(`FATAL: ${err.message}`, "red");
  process.exit(1);
});
