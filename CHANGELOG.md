# Changelog

All notable changes to this project are documented here.

## 0.9.0 (2026-06-04)

### Features
- Sort and filter exercises in the sidebar by difficulty and solving status
- Filter pills: All / Easy / Medium / Hard
- Sort pills: Default / Difficulty / Progress
- Filter/sort bars rendered inline above the exercise list
- Filter/sort reset to All/Default on database switch
- Scroll position preserved across filter/sort re-renders

### Refactoring
- Replaced `updateExerciseListProgress()` with unified `renderExercises()`
- `renderExercises()` owns the full pipeline: filter → sort → build HTML → DOM set
- `selectExercise()` simplified to set `currentId` + call `renderExercises()`
- Added `getProgressWeight()` helper for progress-based sorting
- Added `setFilter()` and `setSort()` functions exposed on window

## 0.8.0 (2026-06-04)

### Build Pipeline
- Split monolithic build into `build:preset` (db/er/schema — rare) and `build:app` (typecheck/version/js/css/gz — every edit)
- `npm start` now runs only `build:app` for fast dev loop
- Added `build:version` script — reads `package.json` → writes `public/VERSION`
- Removed root `VERSION` file (was duplicate; `package.json` is now single source of truth)

### Shared Library
- Extracted `compareResults`, `normalizeValue`, `QueryResult`, `JudgeResult` into `src/lib.ts`
- Both CLI judge (`judge.ts`) and browser judge (`src/app.ts`) import from the same module
- Shared module is bundled into `app.js` via esbuild

### Testing
- Added vitest with 25 unit tests covering all judge algorithm paths
- `npm test` runs in ~300ms
- Tests cover: exact match, set equality, column count/name mismatch, row count, missing/extra rows, NULL handling, floating-point rounding, whitespace, column overlap, multi-issue reporting

### Documentation
- Updated README.md with project structure, build pipeline, versioning, judge algorithm explanation
- Updated ARCHITECTURE.md with new build pipeline, versioning, and testing section
- Updated AGENTS.md with build pipeline split, QA pipeline section, and versioning policy
- Created CHANGELOG.md

### Other
- Removed stale `package.json.tmp` from version bump

## 0.7.3 (2026-06-04)

- Replace badge icons with red/green CSS border highlights for exercise progress
- Failed exercises get red border (#da3633) and dark red background
- Passed exercises keep green border
- Active+passed/failed highlights override correctly
- passCount is monotonic — once passed stays completed

## 0.7.2 (2026-06-04)

- Resize CodeMirror editor only on actual line count change (newlines, paste, merge)
- Sync package.json version with VERSION file

## 0.7.1 (2026-06-04)

- Crash guard in updateExerciseListProgress for undefined records
- Proper null/type guard in loadProgress for localStorage
- escHtml escaping in exercise list to prevent XSS
- CSS specificity fix: .exercise-item.active.completed overrides properly
- Button relabeled to "Reset Progress"
- console.warn for localStorage QuotaExceededError

## 0.7.0-beta (2026-06-04)

- Exercise completion tracking via localStorage
- ProgressRecord with passCount, attemptCount, lastPassed
- Green highlight on completed exercises in sidebar
- Reset progress button with confirm dialog
- Try/catch wrapped for private browsing mode
- Typecheck step wired into build chain
- Synced all version files to canonical source

## 0.6.x Series

### 0.6.5
- Remove obsolete bottom-grip element (entire bottom bar is drag target)
- Collapse all Description tab items by default (no pre-expanded NHOM_HANG)

### 0.6.4
- Full-width bottom bar as resize drag target (not just grip area)
- cursor: ns-resize on bottom-bar hover

### 0.6.3
- Remove invalid CSS title property from .bottom-toggle
- Change collapsed bottom-panel grip cursor to default

### 0.6.2
- Improved bottom panel resize grip visibility (color, padding, hover)
- Height safety guard restores panel if offsetHeight drops below threshold

### 0.6.1
- Self-host CDN assets (CodeMirror, sql.js) at public/vendor/
- Schema descriptions extraction pipeline (SQL comments → descriptions.json)
- Description tab in bottom panel with Vietnamese table/column docs
- Fix TONGTIEN integrity triggers

### 0.6.0
- Hybrid ER diagram rendering: static SVG for preset DB, lazy Mermaid for custom
- Renamed build:er script, added build:er/build:js to package.json
- Deferred app.js loading; removed Mermaid from head
- Gzip compression for static assets
- CSS minification via esbuild
- Parallel init() fetches for VERSION + exercises
- Performance documentation in ARCHITECTURE.md

## 0.5.x Series

### 0.5.1
- Bottom panel initial height set to 22% viewport
- Panel height stable across tab switches
- Collapse/expand restores previous height
- Schema+Description tab combination no longer closes panel permanently

### 0.5.0
- Resizable sidebar with drag grip (280-600px)
- Bottom panel with ER Diagram / Checks / Description tabs
- Vertical resize grip and collapse toggle
- Version badge moved to bottom bar
- Debounced Mermaid re-render on panel resize
- Checks tab shows PK, NOT NULL, FK per table

## 0.4.x Series

### 0.4.1
- Remove leftover inline JavaScript from index.html (was rendering as raw template literals)
- Add asset loading docs to AGENTS.md

### 0.4.0
- TypeScript migration of all source files
- esbuild build pipeline (src/app.ts → public/app.js)
- CLI judge converted to judge.ts
- Scripts converted to TypeScript
- LSP diagnostics resolved (zero errors)

## 0.3.0

- Deduplicate exercises (canonical at public/exercises/exercises.json)
- Move database to public/db/
- Move helper scripts to scripts/
- Remove T-SQL reference scripts (sample.sql, Unilever_Product_Management.sql)
- Update all path references

## 0.2.0

- Fully client-side refactor: remove Express server, use sql.js WASM in browser
- CSS extracted to public/style.css
- All API calls replaced with static asset fetches + in-browser SQL execution
- Database management: load custom SQL, reset to Unilever

## 0.1.0

- Initial project setup
- Express.js server with SQLite backend
- Web UI with exercise list, SQL editor, and judge feedback
- Version badge and VERSION file
- AGENTS.md with versioning policy
