/**
 * Push a single document to Firestore.
 *
 * Usage:
 *   node scripts/pushDocument.js <collection> <documentId> <jsonFile>
 *   node scripts/pushDocument.js <collection> <documentId> --inline '{"key":"value"}'
 *
 * Options:
 *   --merge    Merge with existing document instead of overwriting
 *   --dry-run  Show what would be written without writing
 *
 * Examples:
 *   node scripts/pushDocument.js Roles admin data/roles/admin.json
 *   node scripts/pushDocument.js Users abc123 --inline '{"role":"admin","email":"a@b.com"}'
 *   node scripts/pushDocument.js Roles admin data/roles/admin.json --merge
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
};

function log(msg, color = "reset") {
  console.log(`${C[color] || ""}${msg}${C.reset}`);
}

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const merge = args.includes("--merge");
  const dryRun = args.includes("--dry-run");
  const inlineIdx = args.indexOf("--inline");
  const positional = args.filter((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--inline");

  if (positional.length < 2) {
    log("Usage: node scripts/pushDocument.js <collection> <docId> <jsonFile>", "red");
    log("       node scripts/pushDocument.js <collection> <docId> --inline '{...}'", "red");
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

  // Add timestamps
  const now = admin.firestore.FieldValue.serverTimestamp();
  if (!merge) {
    data.createdAt = data.createdAt || now;
  }
  data.updatedAt = now;

  log(`\n${dryRun ? "[DRY RUN] " : ""}Pushing document: ${collection}/${docId}`, "cyan");
  log(`  Mode: ${merge ? "merge" : "set (overwrite)"}`, "yellow");
  // Show data without timestamps for readability
  const preview = { ...data };
  delete preview.createdAt;
  delete preview.updatedAt;
  log(`  Data: ${JSON.stringify(preview, null, 2)}`, "reset");

  if (dryRun) {
    log("\n[DRY RUN] No changes written.", "yellow");
    process.exit(0);
  }

  const db = admin.firestore();
  await db.collection(collection).doc(docId).set(data, merge ? { merge: true } : {});

  log(`\nDocument ${collection}/${docId} written successfully.`, "green");
  process.exit(0);
}

main().catch((err) => {
  log(`FATAL: ${err.message}`, "red");
  process.exit(1);
});
