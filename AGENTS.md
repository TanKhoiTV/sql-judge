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

## Formatting Changes

Do not call out or comment on formatting-only diffs (whitespace, line wrapping,
indentation) unless there is a semantic issue mixed in. The edit tool sometimes
reformats code when applying AST-aware edits. These are noise. Treat them as
the tool working correctly, not as something to flag or fix.

When a diff shows only formatting changes alongside real edits, commit them
without mention. Do not add "also reformatted" or "auto-format" to commit
messages — it is expected behavior.

## Tools & Skills Workflow

### fork (pi-fork)

Use `fork` to offload noisy or exploratory work to a child Pi process that
inherits the current session branch. Forks return structured 4-section reports:
Result, Output, Evidence, Learnings. Prefer fork over doing the reading/search
inline when the task involves:

- Deep codebase exploration or debugging
- Architecture tradeoff analysis
- Adversarial review of current changes
- Implementation validation
- Parallel option spikes

Call fork with an effort level matching the task:
```
fork({ task: "Investigate why the build is slow", effort: "deep" })
fork({ task: "List all exports in the auth module", effort: "fast" })
```

### subagent (pi-minimal-subagent)

Use `subagent` for role-based delegation through agent definition files in
`~/.pi/agent/agents/*.md`. Available agents:

| Agent | When to use |
|---|---|
| **scout** | Quick codebase recon — find symbols, map entry points, trace flow |
| **planner** | Turn requirements + context into a concrete implementation plan |
| **worker** | Execute a plan with narrow, coherent edits |
| **reviewer** | Review code quality, security, and UX with fresh eyes |
| **advisor** | Strategic advice on architecture and product decisions |
| **researcher** | Web research — searches, evaluates, synthesizes a brief |
| **oracle** | Catch drift between inherited decisions and current trajectory |
| **delegate** | Break broad tasks into parallel work bundles |
| **context-builder** | Examine codebase → comprehensive context document |

Example:
```
subagent({ agent: "scout", task: "Map the auth flow in this project" })
subagent({ agent: "reviewer", task: "Review my current diff for security issues" })
subagent({ agent: "advisor", task: "Evaluate this architecture for the payment module" })
```

### General workflow pattern

1. **Scout** unfamiliar areas before reading whole files.
2. **Fork** noisy exploration or validation to keep main context clean.
3. **Plan** before implementing non-trivial changes.
4. **Worker** to implement after a plan is approved.
5. **Review** changes before committing.
6. **Advisor** for strategic crossroads or architecture decisions.

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
