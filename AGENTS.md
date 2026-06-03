# Project Instructions — SQL Judge

## Architecture

Fully **client-side** SQL practice judge. No server required.

```
public/                     # Web app (http-server serves this directory)
├── index.html              # Main page (HTML + JS)
├── style.css               # All styles
├── db/
│   └── Unilever_Product_Management.db   # Pre-built SQLite database (asset)
├── exercises/
│   └── exercises.json      # Exercise definitions
└── VERSION                 # Version displayed in UI

scripts/                    # Development/CI helper scripts
├── create_db.js            # Rebuild the .db from the .sql script
└── Unilever_Product_Management.sqlite.sql  # SQLite schema + data + triggers

judge.js                    # CLI judge (run from project root)
VERSION                     # Canonical version (syncs with public/VERSION)
```

- SQL executed in-browser via **sql.js** (SQLite compiled to WASM)
- Assets (`.db`, exercises, VERSION) fetched statically by the browser

## Running

```bash
npm start     # http-server on port 3000, serves public/
# or open public/index.html directly
```

## Versioning

- Version tracked in `VERSION` at project root (copied to `public/VERSION` on changes).
- Version badge displayed at bottom-right corner of the web UI.
- **ANY change** bumps version per semantic versioning (`MAJOR.MINOR.PATCH`).
- **Never aggregate changes from different builds** — each change session gets its own version bump in a separate commit.
