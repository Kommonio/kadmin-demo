/**
 * Fetch Firestore document(s) — inspection/debugging utility.
 *
 * Usage:
 *   node scripts/fetchDocument.js <collection>                         — List all (limit 20)
 *   node scripts/fetchDocument.js <collection> <documentId>            — Get by ID
 *   node scripts/fetchDocument.js <collection> --where field=value     — Query
 *   node scripts/fetchDocument.js <collection> --count                 — Count docs
 *
 * Options:
 *   --limit N   Max documents to return (default: 20)
 *
 * Examples:
 *   node scripts/fetchDocument.js Users
 *   node scripts/fetchDocument.js Roles admin
 *   node scripts/fetchDocument.js Users --where role=admin
 *   node scripts/fetchDocument.js Users --count
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
  const args = process.argv.slice(2);

  if (args.length === 0) {
    log("Usage: node scripts/fetchDocument.js <collection> [docId] [--where field=value] [--count] [--limit N]", "red");
    process.exit(1);
  }

  const collection = args[0];
  const db = admin.firestore();

  // Parse options
  const countOnly = args.includes("--count");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : 20;
  const whereIdx = args.indexOf("--where");

  // Count only
  if (countOnly) {
    const snapshot = await db.collection(collection).count().get();
    log(`\nCollection "${collection}": ${snapshot.data().count} document(s)`, "cyan");
    process.exit(0);
  }

  // Fetch by ID
  if (args.length >= 2 && !args[1].startsWith("--")) {
    const docId = args[1];
    log(`\nFetching: ${collection}/${docId}`, "cyan");
    const doc = await db.collection(collection).doc(docId).get();
    if (!doc.exists) {
      log("Document not found.", "red");
      process.exit(1);
    }
    console.log(JSON.stringify({ id: doc.id, ...doc.data() }, null, 2));
    process.exit(0);
  }

  // Query with --where
  if (whereIdx !== -1) {
    const clause = args[whereIdx + 1];
    if (!clause || !clause.includes("=")) {
      log("Invalid --where clause. Use: --where field=value", "red");
      process.exit(1);
    }
    const [field, value] = clause.split("=");
    log(`\nQuerying: ${collection} where ${field} == ${value} (limit ${limit})`, "cyan");

    const snapshot = await db.collection(collection).where(field, "==", value).limit(limit).get();

    if (snapshot.empty) {
      log("No documents found.", "yellow");
      process.exit(0);
    }

    log(`Found ${snapshot.size} document(s):\n`, "green");
    snapshot.docs.forEach((doc) => {
      console.log(JSON.stringify({ id: doc.id, ...doc.data() }, null, 2));
    });
    process.exit(0);
  }

  // List all
  log(`\nListing: ${collection} (limit ${limit})`, "cyan");
  const snapshot = await db.collection(collection).limit(limit).get();

  if (snapshot.empty) {
    log("Collection is empty.", "yellow");
    process.exit(0);
  }

  log(`Found ${snapshot.size} document(s):\n`, "green");
  snapshot.docs.forEach((doc) => {
    console.log(JSON.stringify({ id: doc.id, ...doc.data() }, null, 2));
  });
  process.exit(0);
}

main().catch((err) => {
  log(`FATAL: ${err.message}`, "red");
  process.exit(1);
});
