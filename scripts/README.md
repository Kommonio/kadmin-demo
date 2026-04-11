# Firestore Data Scripts

Utility scripts for pushing, fetching, and inspecting Firestore documents. These work with any collection — they are not tied to specific data models.

## Prerequisites

1. A `.env` file at the project root with `FIREBASE_SERVICE_ACCOUNT_BASE64` set (base64-encoded Firebase service account JSON).
2. Node.js installed.
3. Dependencies installed: `npm install` in the project root (needs `dotenv` and `firebase-admin`).

## Scripts

### `pushDocument.js` — Push a single document

```bash
# From a JSON file
node scripts/pushDocument.js <collection> <docId> <jsonFile>

# From inline JSON
node scripts/pushDocument.js <collection> <docId> --inline '{"key":"value"}'

# Merge instead of overwrite
node scripts/pushDocument.js Roles admin data/roles/admin.json --merge

# Preview without writing
node scripts/pushDocument.js Roles admin data/roles/admin.json --dry-run
```

### `pushCollection.js` — Push multiple documents (batch)

Accepts a JSON file (object keyed by doc ID, or array with `id` fields) or a directory of JSON files (filename = doc ID).

```bash
# From a directory of JSON files
node scripts/pushCollection.js <collection> <directory>

# From a single JSON file
node scripts/pushCollection.js <collection> <jsonFile>

# Clear the collection first, then push
node scripts/pushCollection.js Roles data/roles/ --clean

# Merge with existing documents
node scripts/pushCollection.js Roles data/roles/ --merge

# Preview
node scripts/pushCollection.js Roles data/roles/ --dry-run
```

### `fetchDocument.js` — Fetch / inspect documents

```bash
# List documents (limit 20)
node scripts/fetchDocument.js <collection>

# Get specific document by ID
node scripts/fetchDocument.js <collection> <docId>

# Query by field value
node scripts/fetchDocument.js <collection> --where field=value

# Count documents in collection
node scripts/fetchDocument.js <collection> --count

# Custom limit
node scripts/fetchDocument.js Users --limit 50
```

## Data Files

Seed data for the demo lives in `scripts/data/`. Each sub-folder corresponds to a Firestore collection:

```
scripts/data/
├── roles/
│   ├── admin.json
│   └── user.json
└── samples/
    ├── sample-1.json
    ├── sample-2.json
    └── sample-3.json
```

## Seeding the Demo

Run these commands from the project root to populate the demo database:

```bash
# 1. Seed roles (required — defines admin and user permissions)
node scripts/pushCollection.js Roles scripts/data/roles/

# 2. Seed sample data
node scripts/pushCollection.js Samples scripts/data/samples/
```

After seeding roles, sign up via the app. Then promote your user to admin:

```bash
node scripts/pushDocument.js Users <your-firebase-uid> --inline '{"role":"admin","roles":["admin"],"activeRole":"admin","adminAccess":"superadmin"}' --merge
```

## Timestamps

Both push scripts automatically add `createdAt` and `updatedAt` server timestamps. When using `--merge`, only `updatedAt` is added (preserving the original `createdAt`).
