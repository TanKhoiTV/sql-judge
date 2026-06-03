# Architecture

## Overview

SQL Judge is a **fully client-side** web application. SQL execution, judging, schema introspection, and rendering all happen in the browser via WebAssembly. No backend server, no database server, no build step.

```
┌─────────────────────────────────────────────────────┐
│                   Browser                            │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │                 index.html                       │ │
│  │  ┌─────────┐  ┌─────────────┐  ┌────────────┐  │ │
│  │  │ sql.js  │  │  CodeMirror │  │  Mermaid   │  │ │
│  │  │ (WASM)  │  │  (editor)   │  │  (ER dia)  │  │ │
│  │  └────┬────┘  └──────┬──────┘  └─────┬──────┘  │ │
│  │       │              │                │         │ │
│  │  ┌────┴──────────────┴────────────────┴──┐      │ │
│  │  │        JavaScript Application          │      │ │
│  │  │  (judge, schema, UI logic)            │      │ │
│  │  └───────────────────────────────────────┘      │ │
│  └─────────────────────────────────────────────────┘ │
│                          │                            │
│                          ▼                            │
│  ┌─────────────────────────────────────────────────┐ │
│  │         Static Assets (public/ directory)        │ │
│  │  db/Unilever_Product_Management.db  (binary DB)  │ │
│  │  exercises/exercises.json         (definitions)  │ │
│  │  VERSION                         (version text)  │ │
│  │  style.css                       (all styles)    │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Directory Layout

```
public/                          # Served by http-server (the web app)
├── index.html                   # Main HTML + all JS logic
├── style.css                    # All styles (extracted from inline)
├── db/
│   └── Unilever_Product_Management.db   # Pre-built SQLite database file
├── exercises/
│   └── exercises.json           # 13 exercise definitions with solutions
└── VERSION                      # Version string displayed in UI

scripts/                         # Development helper scripts
├── create_db.js                 # Rebuilds .db from the .sqlite.sql file
└── Unilever_Product_Management.sqlite.sql  # Full schema + data + triggers

judge.js                         # CLI judge (runs on Node.js)
VERSION                          # Canonical version (copied to public/VERSION)
package.json                     # Only dependency: http-server
AGENTS.md                        # Pi coding agent project instructions
```

## Technology Stack

| Layer | Technology | Role |
|-------|-----------|------|
| SQL engine | **sql.js** (SQLite via WebAssembly) | Execute all SQL queries in-browser |
| Editor | **CodeMirror 5** | SQL editor, syntax highlighting, autocomplete |
| Diagrams | **Mermaid.js** | ER diagram rendering from foreign key metadata |
| Static server | **http-server** | Serves `public/` directory (only needed because browsers block `file://` fetches) |
| CLI | **Node.js 24+** (`node:sqlite`) | CLI judge runs on `DatabaseSync` built-in module |
| SQL script | **SQLite-compatible SQL** | Schema, constraints, sample data, triggers |

## Data Flow

### Initial Load
```
1. index.html loads in browser
2. init() called:
   a. fetch("exercises/exercises.json") → parsed into allExerciseDefs
   b. fetch("db/Unilever_Product_Management.db") → fetched as ArrayBuffer
   c. new SQL.Database(new Uint8Array(buffer)) → creates in-memory SQLite
   d. getSchema() → PRAGMA table_info + foreign_key_list on every table
   e. renderTableCards(), loadExercises(), refreshEditorHints()
```

### Judge Flow (Practice Mode)
```
1. User writes SQL in CodeMirror editor, clicks "Run"
2. runJudge():
   a. db.exec(userQuery)     → user result
   b. db.exec(ex.solution)   → reference result
   c. compareResults():
      • Column count & name comparison (case-insensitive)
      • Row count comparison
      • Normalized value set comparison (order-independent)
   d. renderJudgeResults():
      • PASS / FAIL with issue list
      • Hint display on failure
      • Result table(s) for both user and reference
```

### Schema Viewer Flow
```
1. User clicks "Schema" tab in sidebar
2. loadSchemaData() → PRAGMA table_info + foreign_key_list
3. renderTableCards() → HTML for collapsible table cards
4. renderERDiagram() → builds Mermaid erDiagram from FK metadata
5. Mermaid renders SVG inside the schema panel
```

### Database Swap Flow
```
1. User clicks "Load SQL", pastes script or uploads file
2. loadSqlFromText():
   a. new SQL.Database()         → empty database
   b. db.run("PRAGMA foreign_keys = ON")
   c. db.run(userSql)            → user-provided SQL
   d. Replaces global db reference
   e. reloadSchema(), clearExercises() (exercises only work for Unilever)
   f. UI switches to Sandbox mode
```

## Judge Algorithm

The judge in `index.html` (and its CLI counterpart in `judge.js`) compares two result sets:

1. **Column validation** — number of columns must match; names compared case-insensitively
2. **Row count** — must be identical
3. **Data comparison** — rows from both results are normalized (numbers rounded to 9 decimal places, whitespace trimmed) and placed into sets keyed on the first N columns (where N = min of both column counts). Missing and extra rows are identified by set difference.

The judge does NOT enforce row order — the comparison is set-based.

## Exercise Format

Exercises are JSON objects in `public/exercises/exercises.json`:

```json
{
  "id": "06-top-selling",
  "title": "Top 3 best-selling products",
  "difficulty": "Medium",
  "tables": ["CTHD", "HANG_HOA"],
  "question": "Find the top 3 products by total quantity sold ...",
  "solution": "SELECT h.MAHH, h.TENHH, SUM(c.SLBAN) AS TongSL\nFROM CTHD c\nJOIN HANG_HOA h ON c.MAHH = h.MAHH\nGROUP BY h.MAHH\nORDER BY TongSL DESC\nLIMIT 3;",
  "hint": "Use SUM(c.SLBAN), GROUP BY, ORDER BY DESC, LIMIT 3"
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique slug, used for routing and CLI reference |
| `title` | Human-readable name |
| `difficulty` | One of `Easy`, `Medium`, `Hard` |
| `tables` | Tables the user needs to query |
| `question` | Full question text shown to the user |
| `solution` | Reference SQL — compared against user's answer |
| `hint` | Shown on failure to help debug |

## Database Constraints

The SQLite schema enforces several constraints beyond basic PK/FK:

- **CHECK constraints** — `DONGIA > 0`, `SLTON >= 0`, `THANHTIEN >= 0`, `CKBAN BETWEEN 0 AND 1`, etc.
- **NOT NULL** — 18 columns across 8 tables enforce non-null values
- **UNIQUE** — `DAI_LY.MASOTHUE` (tax code), `DOI.MANHOM` (one group per team)
- **GIOITINH** — constrained to `'Nam'` or `'Nữ'` via CHECK
- **Triggers:**
  - `trg_cthd_insert/update/delete` — auto-syncs `HOA_DON.TONGTIEN` when CTHD rows change
  - `trg_nhanvien_insert_update` — enforces max 1 team leader (TD) and max 1 delivery person (GH) per team

## Versioning

- Canonical version in root `VERSION` file (plain text, semver).
- `public/VERSION` is a copy served to the web UI.
- Version badge renders at bottom-right of the page.
- Every change session must bump the version in a separate commit. No aggregation of unrelated changes.

## CLI Judge

The CLI (`judge.js`) mirrors the browser judge logic using `node:sqlite` (built into Node.js 24+). Same comparison algorithm, same exercise file, same database.

```bash
node judge.js list
node judge.js solve 03-simple-join "YOUR QUERY"
node judge.js show 09-subquery
node judge.js random
```

## Rebuilding the Database

```bash
node scripts/create_db.js
```

This reads `scripts/Unilever_Product_Management.sqlite.sql` and produces a fresh `public/db/Unilever_Product_Management.db`. The script also prints verification output — row counts, product catalog, team mappings, and invoices.
