# Project Instructions — SQL Judge

## Architecture

Fully **client-side** SQL practice judge. No server required.

```
public/                     # Web app (http-server serves this directory)
├── index.html              # Main page (HTML structure, no inline JS)
├── app.js                  # Compiled JS (from src/app.ts via esbuild)
├── style.css               # All styles
├── vendor/                 # Self-hosted vendor libs (CodeMirror, sql.js)
├── db/
│   ├── Unilever_Product_Management.db   # Pre-built SQLite database (asset)
│   ├── Unilever_Product_Management.er.svg  # Static ER diagram
│   └── Unilever_Product_Management.descriptions.json  # Column descriptions
├── exercises/
│   └── exercises.json      # Exercise definitions
└── VERSION                 # Version displayed in UI (generated from package.json)

src/                        # TypeScript source
├── app.ts                  # Browser app logic (compiled → public/app.js)
├── lib.ts                  # Shared: compareResults, normalizeValue, types

tests/                      # Vitest unit/integration tests
└── unit/
    └── compareResults.test.ts  # Judge algorithm tests

scripts/                    # Development/CI helper scripts (TypeScript)
├── create_db.ts            # Rebuild the .db from the .sql script
├── write_version.ts        # Write package.json version → public/VERSION
├── render_er_svg.ts        # Generate static ER diagram SVG
├── extract_descriptions.ts # Extract SQL comment descriptions
├── gzip_assets.ts          # Gzip static assets for deployment
└── Unilever_Product_Management.sqlite.sql  # SQLite schema + data + triggers

judge.ts                    # CLI judge (run with tsx from project root)
tsconfig.json               # TypeScript configuration
vitest.config.ts            # Vitest test runner config
```

- SQL executed in-browser via **sql.js** (SQLite compiled to WASM)
- Assets (`.db`, exercises, VERSION) fetched statically by the browser
- TypeScript compiled to JS via esbuild (no type-checking at compile time)
- Node.js scripts run directly via tsx

## Running

```bash
npm run build       # Full build: preset DB + app (build:preset && build:app)
npm run build:app   # Fast dev build: typecheck → version → JS → CSS → gzip
npm run build:preset # Rebuild preset DB artifacts only (db + er + schema)
npm start           # build:app + serve on port 3000
npm run dev         # Serve only (no build, assumes assets are up to date)
npm test            # Run vitest unit tests
npm run test:cli    # Run CLI judge (npx tsx judge.ts)
npm run qa          # Run QA agent (build + test + smoke check — see qa subagent)
```

## Build Pipeline

Build scripts are split into two groups:

| Group | Scripts | When to run |
|---|---|---|
| **build:preset** | `build:db` → `build:er` → `build:schema` | Only when SQL schema changes (rare) |
| **build:app** | `typecheck` → `build:version` → `build:js` → `build:css` → `build:gz` | Every code edit (fast) |

`npm run build` runs both sequentially. `npm start` runs only `build:app` for a fast dev loop.

- `build:version` reads `package.json` version and writes `public/VERSION` (single source of truth)
- `build:db` creates SQLite `.db` from `scripts/*.sqlite.sql`
- `build:er` generates static ER diagram SVG from `.db`
- `build:schema` extracts table/column descriptions from `.sql` comments
- `build:js` compiles `src/app.ts` (bundles `src/lib.ts`) via esbuild
- `build:css` minifies `style.css`
- `build:gz` gzips all static assets at max compression

## Asset Loading

- `public/app.js` is the compiled JS (from `src/app.ts` via esbuild), loaded by index.html via `<script src="app.js">`.
- `public/index.html` must NOT contain inline JavaScript beyond small event handler attributes (`onclick`, etc.).
  All application logic lives in `src/app.ts`. Stale inline JS left in `index.html` will be rendered
  as raw text by the browser and leak template literal strings onto the page.
- After editing `src/app.ts`, rebuild with `npm run build` and verify no raw template literals
  appear in the browser snapshot (`agent-browser snapshot -i`).

## Formatting Changes

Do not call out or comment on formatting-only diffs (whitespace, line wrapping,
indentation) unless there is a semantic issue mixed in. The edit tool sometimes
reformats code when applying AST-aware edits. These are noise. Treat them as
the tool working correctly, not as something to flag or fix.

When a diff shows only formatting changes alongside real edits, commit them
without mention. Do not add "also reformatted" or "auto-format" to commit
messages — it is expected behavior.

## Problem-Solving Discipline

### Blockers

When stuck on an implementation problem, follow this order:

1. **Check existing skills** — Read the relevant skill files under
   `~/.pi/agent/skills/` and `~/.agents/skills/`. The tool definitions in your
   system prompt list available skills with descriptions; read the matching
   `SKILL.md` for full instructions.

2. **Web search** — Perform a targeted web search for the specific error,
   library API, or pattern. Use concrete search terms (framework + version +
   error message).

3. **Only then implement** — Never guess a workaround or fabricate an API.
   Research first.

### Deep-rooted Errors

When a bug resists diagnosis after a reasonable attempt:

- Launch a **debugging subagent** (delegate or worker) with the specific
debugger tools included (e.g., `agent-browser` for UI inspection, `node
--inspect` for Node.js, LSP diagnostics for TypeScript).
- State the error, what you've tried, and what debugger tools the subagent
should use.
- Do not chase the bug in the main context — isolate it in a subagent that
has a clean context window.

### Code Architecture

- **Separation of concerns** — Keep UI, data access, and business logic in
distinct modules/functions. A view function should not directly mutate the
database. A data function should not manipulate the DOM.

- **State vs. logic** — Module-level variables hold state (current database,
selected exercise, active tab). Pure functions and event handlers contain
logic. State mutations happen at clear boundaries (after data loads, user
clicks, database swaps), not scattered inside rendering helpers. This makes
behavior predictable and bugs easier to trace.

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

- **Single source of truth**: `package.json` version field.
- `npm run build:version` writes `package.json` version → `public/VERSION` (served to web UI).
- Version badge displayed at bottom-right corner of the web UI.
- **ANY change** bumps version per semantic versioning (`MAJOR.MINOR.PATCH`).
- **Never aggregate changes from different builds** — each change session gets its own version bump in a separate commit.
- When bumping: edit `package.json`'s `version` field. `build:version` syncs it to `public/VERSION`.

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

## QA Pipeline

Use the **qa** subagent after any code change:

```
subagent({ agent: "qa", task: "Run QA checks on the SQL Judge project" })
```

The QA agent runs:
1. `npm run build` — full build
2. `npm test` — vitest unit tests (judge algorithm, value normalization)
3. CLI judge smoke tests (PASS + FAIL scenarios)
4. Build artifact validation (public/VERSION, .db, app.js, .er.svg)
5. `npm run typecheck` — TypeScript type checking
6. Git status check for uncommitted changes

### Test Structure

```
tests/
├── unit/
│   └── compareResults.test.ts   # Pure-function tests for judge algorithm
├── integration/                 # CLI + DB integration tests (future)
└── build/                       # Artifact validation (future)
```

Run tests: `npm test` (vitest).

### Working with Tests

- `npm test` — run all tests once (CI mode)
- `npm vitest` — run tests in watch mode (dev)
- Tests import `compareResults` and `normalizeValue` from `src/lib.ts`, the same shared module used by both the CLI judge and the browser judge. A test that passes guarantees the algorithm is correct in both environments.

Examples:
```
feat(judge): add discount-analysis exercise
fix(ui): correct ER diagram cardinality direction
refactor: migrate to client-side sql.js
chore: add .gitattributes for LF line endings
```
