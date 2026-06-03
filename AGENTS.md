# Project Instructions — SQL Judge for Unilever Database

## Architecture

This is a **fully client-side** application. No server required.
- `public/index.html` — main page (HTML + JS logic)
- `public/style.css` — all styles (extracted from inline)
- `public/Unilever_Product_Management.db` — pre-built SQLite database
- `public/exercises/` — exercise definitions (JSON)
- `public/VERSION` — version tracking

SQL execution happens in-browser via **sql.js** (WASM port of SQLite).
The `.db` file and all other assets are fetched statically by the browser.

## Running

```bash
# Option A: open public/index.html directly (some browsers may block fetch)
# Option B: serve with any static server
npm start   # http-server on port 3000
```

## Versioning

- Version is tracked in the `VERSION` file at project root (copied to `public/VERSION`).
- The version badge is displayed at the bottom-right corner of the web UI.
- **ANY change** to any project file must bump the version according to semantic versioning (`MAJOR.MINOR.PATCH`).
- **Never aggregate changes from different builds** — each change session gets its own version bump in a separate commit.
