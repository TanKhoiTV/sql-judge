# Project Instructions — SQL Judge

## Architecture

Fully **client-side** SQL practice judge. No server required.

```
public/                     # Web app (http-server serves this directory)
├── index.html              # Main page (HTML structure, no inline JS)
├── app.js                  # Compiled JS (from src/app.ts via esbuild)
├── style.css               # All styles
├── db/
│   └── Unilever_Product_Management.db   # Pre-built SQLite database (asset)
├── exercises/
│   └── exercises.json      # Exercise definitions
└── VERSION                 # Version displayed in UI

src/                        # TypeScript source
└── app.ts                  # Browser app logic (compiled → public/app.js)

scripts/                    # Development/CI helper scripts (TypeScript)
├── create_db.ts            # Rebuild the .db from the .sql script
└── Unilever_Product_Management.sqlite.sql  # SQLite schema + data + triggers

judge.ts                    # CLI judge (run with tsx from project root)
tsconfig.json               # TypeScript configuration
VERSION                     # Canonical version (syncs with public/VERSION)
```

- SQL executed in-browser via **sql.js** (SQLite compiled to WASM)
- Assets (`.db`, exercises, VERSION) fetched statically by the browser
- TypeScript compiled to JS via esbuild (no type-checking at compile time)
- Node.js scripts run directly via tsx

## Running

```bash
npm run build   # Compile src/app.ts → public/app.js
npm start       # Build + serve on port 3000
npm run dev     # Serve only (no build, assumes app.js is up to date)
npm test        # Run CLI judge (npx tsx judge.ts)
```

## Versioning

- Version tracked in `VERSION` at project root (copied to `public/VERSION` on changes).
- Version badge displayed at bottom-right corner of the web UI.
- **ANY change** bumps version per semantic versioning (`MAJOR.MINOR.PATCH`).
- **Never aggregate changes from different builds** — each change session gets its own version bump in a separate commit.

## Conventional Commits

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]
```

Types: `feat` (new feature), `fix` (bug fix), `docs` (documentation),
`refactor` (code change with no feature/fix), `style` (formatting, CSS),
`perf` (performance), `test` (tests), `chore` (tooling, infra, config).

Scope is optional but encouraged (e.g., `judge`, `ui`, `db`, `scripts`, `docs`).

Examples:
```
feat(judge): add discount-analysis exercise
fix(ui): correct ER diagram cardinality direction
refactor: migrate to client-side sql.js
chore: add .gitattributes for LF line endings
```
