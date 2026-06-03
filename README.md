# SQL Judge — Practice SQL in Your Browser

A fully client-side SQL practice judge built around a Unilever Vietnam product management database. Write queries, get instant pass/fail feedback, visualize the schema — no server required.

## Features

- **13 exercises** — Easy → Hard, covering SELECT, WHERE, JOIN, GROUP BY, HAVING, subqueries, date ranges
- **Auto-grading** — your query is compared against a reference solution (columns, rows, data, ordering)
- **CLI judge** — practice from the terminal with `node judge.js solve <id>`
- **Schema viewer** — collapsible table cards with columns, types, PKs, FKs, and NOT NULL constraints
- **ER diagram** — auto-generated from foreign keys (Mermaid.js)
- **CodeMirror editor** — syntax highlighting, schema-aware autocomplete
- **Sandbox mode** — run any SQL query freely
- **Load custom SQL** — paste or upload any SQLite script to swap databases
- **Triggers** — TONGTIEN auto-syncs when CTHD rows change; team role constraints enforce max 1 leader and 1 delivery person per team

## Quick Start

```bash
# Install (only http-server — no database server needed)
npm install

# Start the web UI
npm start

# Open http://localhost:3000
```

Or just open `public/index.html` directly in a browser.

## CLI Usage

```bash
node judge.js list                  # List all exercises
node judge.js show 06-top-selling   # Show the question
node judge.js solve 06-top-selling "SELECT MAHH, SUM(SLBAN) FROM CTHD GROUP BY MAHH ORDER BY SUM(SLBAN) DESC LIMIT 3"
node judge.js solve 01-simple-select -f my_query.sql
node judge.js random                # Pick a random exercise
```

## Exercises

| # | Title | Difficulty |
|---|-------|------------|
| 01 | All products with their prices | Easy |
| 02 | Products in a specific group | Easy |
| 03 | Products with group names | Easy |
| 04 | Products per group | Easy |
| 05 | Revenue by product group | Medium |
| 06 | Top 3 best-selling products | Medium |
| 07 | Employees grouped by role | Medium |
| 08 | Invoice details with product and agent names | Medium |
| 09 | Products above average price | Hard |
| 10 | Highest-spending agent | Hard |
| 11 | Invoices in a date range | Easy |
| 12 | Team revenue ranking | Hard |
| 13 | Invoices with high discounts | Medium |

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

Key points:
- **HANG_HOA** has composite PK + FK referencing both NHOM_HANG (group) and HINH_THUC_DONG_GOI (packaging)
- **CTHD** and **CTPX** are detail tables with composite PKs referencing parent + product
- **HOA_DON.TONGTIEN** is auto-synced via triggers on CTHD inserts/updates/deletes
- Role constraints: max 1 team leader (TD) and max 1 delivery person (GH) per team

## Using Your Own Database

1. Click **Load SQL** in the top bar
2. Paste a SQLite-compatible SQL script or upload a `.sql` file
3. Optionally name your database
4. Sandbox mode to run queries — exercises only work with the built-in Unilever database

## Technology

- **sql.js** — SQLite compiled to WebAssembly, runs entirely in the browser
- **CodeMirror 5** — SQL editor with syntax highlighting and autocomplete
- **Mermaid.js** — Entity-relationship diagrams
- **http-server** — minimal static file server (only needed because CORS blocks local file fetches)
- **Node.js 24+** — only for the CLI judge (`node:sqlite` built-in module)

## License

ISC
