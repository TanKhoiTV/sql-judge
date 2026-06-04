# SQL Judge — Practice SQL in Your Browser

A fully client-side SQL practice judge built around a Unilever Vietnam product management database. Write queries, get instant pass/fail feedback, visualize the schema — no server required.

## Features

- **30 exercises** — 10 Easy, 11 Medium, 9 Hard, covering SELECT, WHERE, JOIN, GROUP BY, HAVING, subqueries, date ranges, DISTINCT, LIKE, IS NULL, IN, MIN/MAX/AVG, LEFT JOIN, EXISTS/NOT EXISTS, correlated subqueries, self JOIN, relational division, derived tables, CASE expressions, and more
- **Auto-grading** — your query is compared against a reference solution (columns, rows, data, ordering)
- **CLI judge** — practice from the terminal with `npx tsx judge.ts`
- **Schema viewer** — collapsible table cards with columns, types, PKs, FKs, and NOT NULL constraints
- **ER diagram** — pre-rendered static SVG for the preset database (zero JS cost); Mermaid.js lazy-loaded for custom DBs
- **Description tab** — Vietnamese table and column descriptions extracted from the spec PDF
- **CodeMirror editor** — syntax highlighting, schema-aware autocomplete
- **Sandbox mode** — run any SQL query freely
- **Load custom SQL** — paste or upload any SQLite script to swap databases
- **Progress tracking** — solved/failed badges persist in localStorage; green for passed, red for attempted
- **Integrity triggers** — TONGTIEN auto-syncs when CTHD rows change; team role constraints enforce max 1 leader and 1 delivery person per team

## Quick Start

```bash
# Install (only http-server — no database server needed)
npm install

# Start the web UI (builds JS/CSS, then serves on port 3000)
npm start

# Open http://localhost:3000
```

**Note:** `public/index.html` cannot be opened directly from the filesystem — sql.js WASM requires HTTP serving due to CORS. Use `npm start` or `npm run dev`.

## CLI Usage

```bash
npx tsx judge.ts list                  # List all exercises
npx tsx judge.ts show 06-top-selling   # Show the question
npx tsx judge.ts solve 06-top-selling "SELECT MAHH, SUM(SLBAN) FROM CTHD GROUP BY MAHH ORDER BY SUM(SLBAN) DESC LIMIT 3"
npx tsx judge.ts solve 01-simple-select -f my_query.sql
npx tsx judge.ts random                # Pick a random exercise
```

## Build

```bash
npm run build       # Full build: preset DB artifacts + app (typecheck, JS, CSS, gzip)
npm run build:app   # Fast dev build: typecheck → version sync → JS → CSS → gzip
npm run build:preset # Preset DB only: SQL script → .db → ER SVG → descriptions
npm run build:js    # Compile src/app.ts → public/app.js (esbuild, ~16ms)
npm test            # Run 25 vitest unit tests
npm run typecheck   # tsc --noEmit (zero errors required)
```

The build pipeline is split into two groups:
- **`build:preset`** (rare) — rebuilds the SQLite database, ER diagram SVG, and column descriptions from the SQL script. Run only when the schema changes.
- **`build:app`** (every edit) — typechecks TypeScript, syncs version, compiles JS, minifies CSS, gzips assets. Takes ~2 seconds.

`npm start` runs only `build:app` for a fast dev loop.

## Exercises

| # | Title | Difficulty | Topic |
|---|-------|------------|-------|
| 01 | All products with their prices | Easy | SELECT, ORDER BY |
| 02 | Products in a specific group | Easy | WHERE |
| 03 | Products with group names | Easy | INNER JOIN |
| 04 | Products per group | Easy | GROUP BY, COUNT |
| 11 | Invoices in a date range | Easy | Date range, JOIN |
| 14 | Distinct product groups | Easy | DISTINCT |
| 15 | Search agents by name | Easy | LIKE |
| 16 | Packaging without secondary unit | Easy | IS NULL |
| 17 | Products in selected groups | Easy | IN clause |
| 18 | Price statistics | Easy | MIN, MAX, AVG |
| 05 | Revenue by product group | Medium | 3-table JOIN, SUM, GROUP BY |
| 06 | Top 3 best-selling products | Medium | SUM, GROUP BY, LIMIT |
| 07 | Employees grouped by role | Medium | GROUP BY, HAVING |
| 08 | Invoice details with product and agent names | Medium | 4-table JOIN |
| 13 | Invoices with high discounts | Medium | WHERE, multi-JOIN |
| 19 | Products that have been sold | Medium | Subquery with IN |
| 20 | Employee invoice activity | Medium | LEFT JOIN, aggregation |
| 21 | Products never sold | Medium | Subquery with NOT IN |
| 22 | Agents who have created invoices | Medium | EXISTS |
| 23 | Agents with no invoice activity | Medium | NOT EXISTS |
| 24 | Monthly revenue in 2008 | Medium | Date aggregation |
| 25 | Above average for their group | Medium | Correlated subquery |
| 09 | Products above average price | Hard | Scalar subquery |
| 10 | Highest-spending agent | Hard | Multi-JOIN, LIMIT |
| 12 | Team revenue ranking | Hard | Multi-JOIN, aggregation |
| 26 | Agents buying from all groups | Hard | Relational division |
| 27 | Product pairs in the same group | Hard | Self JOIN |
| 28 | Average revenue per employee | Hard | Derived table |
| 29 | Products never sold at deep discount | Hard | Correlated NOT EXISTS |
| 30 | Top agents by group coverage and spending | Hard | Compound HAVING |
| 31 | Custom invoice sorting | Hard | CASE in ORDER BY |

## Project Structure

```
public/                     # Static web app
├── index.html              # Main page (no inline JS)
├── app.js                  # Compiled JS (build artifact, gitignored)
├── style.css / style.min.css
├── vendor/                 # Self-hosted CodeMirror + sql.js
├── db/
│   ├── Unilever_Product_Management.db
│   ├── Unilever_Product_Management.er.svg
│   └── Unilever_Product_Management.descriptions.json
├── exercises/exercises.json
└── VERSION                 # Generated from package.json

src/                        # TypeScript source
├── app.ts                  # Browser logic
└── lib.ts                  # Shared: compareResults, normalizeValue, types

tests/
└── unit/compareResults.test.ts  # 25 vitest tests

scripts/                    # Build scripts (TypeScript)
├── create_db.ts            # SQL script → .db
├── render_er_svg.ts        # .db → ER SVG
├── extract_descriptions.ts # SQL comments → descriptions.json
├── write_version.ts        # package.json → public/VERSION
└── gzip_assets.ts          # Gzip static assets

judge.ts                    # CLI judge (uses same lib.ts as browser)
```

## Database Schema (11 tables)

```
NHOM_HANG (product groups) ──────┐
    │                             │
    ├─ DOI (teams)                ├─ HANG_HOA (products)
    │   │                         │
    │   └─ NHAN_VIEN (employees)  │
    │                             │
    ├─ DAI_LY (agents) ─── HOA_DON (invoices) ──┐
    │                                 │         │
    │                            PHIEU_XUAT (delivery notes) ── CTPX (delivery items)
    │                                         │
    └─ HINH_THUC_DONG_GOI (packaging) ── HANG_HOA
                                              │
                                         CTHD (invoice items) ── HOA_DON
                                              │
                                         CTPX (delivery items)
```

Key constraints:
- **HANG_HOA** has composite PK + FK referencing both NHOM_HANG and HINH_THUC_DONG_GOI
- **CTHD** and **CTPX** are detail tables with composite PKs referencing parent + product
- **HOA_DON.TONGTIEN** is auto-synced via triggers on CTHD inserts/updates/deletes
- Role constraints: max 1 team leader (TD) and max 1 delivery person (GH) per team
- Column descriptions (Vietnamese) extracted from the PDF specification — view in the Description tab

## Using Your Own Database

1. Click **Load SQL** in the top bar
2. Paste a SQLite-compatible SQL script or upload a `.sql` file
3. Optionally name your database
4. Switch to Sandbox mode to run queries — exercises only work with the built-in Unilever database
5. Click **Reset** to restore the preset database

## How the Judge Works

1. Your SQL and the reference solution execute against the same database
2. Column sets are compared (names, order, count)
3. Row data is compared as **unordered sets** — order doesn't matter
4. Values are normalized (nulls, floats rounded to 9dp, whitespace trimmed)
5. A structured report shows: row count mismatch, missing/extra rows, column differences

The comparison algorithm lives in `src/lib.ts` and is shared between the CLI judge (`judge.ts`) and the browser judge (bundled into `app.js`). All logic paths are covered by 25+ vitest unit tests.

## Technology

- **sql.js** — SQLite compiled to WebAssembly, runs entirely in the browser
- **CodeMirror 5** — SQL editor with syntax highlighting and autocomplete
- **Mermaid.js** — Entity-relationship diagrams (lazy-loaded for custom databases)
- **http-server** — minimal static file server
- **Node.js 24+** — CLI judge via built-in `node:sqlite`
- **TypeScript** — all source (esbuild for browser, tsx for scripts)
- **esbuild** — JS bundling and CSS minification
- **vitest** — unit test runner

## Versioning

Canonical version is in `package.json`. Run `npm run build:version` to sync to `public/VERSION`. Version badge displayed at bottom-right of the web UI.

## License

MIT
