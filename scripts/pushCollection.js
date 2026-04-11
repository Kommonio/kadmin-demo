/**
 * Push multiple documents (batch) to a Firestore collection.
 *
 * Usage:
 *   node scripts/pushCollection.js <collection> <jsonFile>
 *   node scripts/pushCollection.js <collection> <directory>
 *
 * The JSON file must be either:
 *   - An object where keys are document IDs:  { "doc1": {...}, "doc2": {...} }
 *   - An array of objects each containing an "id" field: [{ "id": "doc1", ... }]
 *
 * If a directory is given, each .json file in it becomes a document
 * (filename without extension = document ID).
 *
 * Options:
 *   --merge    Merge with existing documents instead of overwriting
 *   --dry-run  Show what would be written without writing
 *   --clean    Delete all existing documents in the collection first
 *
 * Examples:
 *   node scripts/pushCollection.js Roles data/roles/
 *   node scripts/pushCollection.js Roles data/roles.json
 *   node scripts/pushCollection.js Roles data/roles.json --merge
 *   node scripts/pushCollection.js Roles data/roles.json --clean --dry-run
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

/**
 * Load documents from a JSON file or a directory of JSON files.
 * Returns a Map<docId, data>.
 */
function loadDocuments(source) {
  const resolved = path.resolve(source);
  const docs = new Map();

  if (fs.statSync(resolved).isDirectory()) {
    // Each .json file = one document (filename = docId)
    const files = fs.readdirSync(resolved).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const docId = path.basename(file, ".json");
      const data = JSON.parse(fs.readFileSync(path.join(resolved, file), "utf8"));
      docs.set(docId, data);
    }
  } else {
    // Single JSON file — object or array
    const raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (!item.id) {
          log("ERROR: Array items must have an 'id' field.", "red");
          process.exit(1);
        }
        const { id, ...rest } = item;
        docs.set(id, rest);
      }
    } else if (typeof raw === "object") {
      for (const [key, value] of Object.entries(raw)) {
        docs.set(key, value);
      }
    }
  }

  return docs;
}

async function main() {
  const args = process.argv.slice(2);
  const merge = args.includes("--merge");
  const dryRun = args.includes("--dry-run");
  const clean = args.includes("--clean");
  const positional = args.filter((a) => !a.startsWith("--"));

  if (positional.length < 2) {
    log("Usage: node scripts/pushCollection.js <collection> <jsonFile|directory>", "red");
    process.exit(1);
  }

  const collection = positional[0];
  const source = positional[1];

  if (!fs.existsSync(path.resolve(source))) {
    log(`ERROR: Source not found: ${source}`, "red");
    process.exit(1);
  }

  const docs = loadDocuments(source);
  log(`\n${dryRun ? "[DRY RUN] " : ""}Pushing ${docs.size} document(s) to ${collection}`, "cyan");
  log(`  Mode: ${merge ? "merge" : "set (overwrite)"}${clean ? " + CLEAN first" : ""}`, "yellow");

  for (const [docId, data] of docs) {
    log(`  • ${docId}`, "reset");
  }

  if (dryRun) {
    log("\n[DRY RUN] No changes written.", "yellow");
    process.exit(0);
  }

  const db = admin.firestore();

  // Clean existing documents if requested
  if (clean) {
    log(`\nDeleting existing documents in ${collection}...`, "yellow");
    const snapshot = await db.collection(collection).get();
    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      log(`  Deleted ${snapshot.size} document(s).`, "yellow");
    }
  }

  // Write in batches of 500 (Firestore limit)
  const entries = [...docs.entries()];
  const BATCH_SIZE = 500;
  let written = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();

    for (const [docId, data] of chunk) {
      const ref = db.collection(collection).doc(docId);
      const withTimestamps = {
        ...data,
        updatedAt: now,
      };
      if (!merge) {
        withTimestamps.createdAt = data.createdAt || now;
      }
      batch.set(ref, withTimestamps, merge ? { merge: true } : {});
    }

    await batch.commit();
    written += chunk.length;
  }

  log(`\n${written} document(s) written to ${collection}.`, "green");
  process.exit(0);
}

main().catch((err) => {
  log(`FATAL: ${err.message}`, "red");
  process.exit(1);
});
