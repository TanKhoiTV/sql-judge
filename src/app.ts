// ─── Type declarations for CDN globals ─────────────────────────────────────
declare function initSqlJs(opts?: {
	locateFile?: (file: string) => string;
}): Promise<any>;

declare class CodeMirror {
	static fromTextArea(
		textarea: HTMLTextAreaElement,
		options?: Record<string, any>,
	): any;
	static commands: { autocomplete: (cm: any, ...args: any[]) => void };
}

declare var mermaid: {
	initialize: (config: Record<string, any>) => void;
	run: (opts: { nodes: Element[] }) => Promise<void>;
};

// ─── Globals ───────────────────────────────────────────────────────────────
// ─── Exercise Progress (localStorage) ──────────────────────────────────────
interface ProgressRecord {
	passCount: number;
	attemptCount: number;
	lastPassed: string | null;
}

function loadProgress(): Record<string, ProgressRecord> {
	try {
		const raw = localStorage.getItem("sqljudge_progress");
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null) return {};
		return parsed;
	} catch {
		return {};
	}
}

function saveProgress(progress: Record<string, ProgressRecord>): void {
	try {
		localStorage.setItem("sqljudge_progress", JSON.stringify(progress));
	} catch (e) {
		if (e instanceof DOMException && e.name === "QuotaExceededError") {
			console.warn("Could not save progress: localStorage quota exceeded");
		}
	}
}

function recordAttempt(exId: string, passed: boolean): void {
	const progress = loadProgress();
	const rec = progress[exId] || {
		passCount: 0,
		attemptCount: 0,
		lastPassed: null,
	};
	rec.attemptCount++;
	if (passed) {
		rec.passCount++;
		rec.lastPassed = new Date().toISOString();
	}
	progress[exId] = rec;
	saveProgress(progress);
	renderExercises();
}

function getProgressWeight(rec: any): number {
	if (rec && rec.passCount > 0) return 2;
	if (rec && rec.attemptCount > 0) return 1;
	return 0;
}

function resetProgress(): void {
	if (!confirm("Reset all exercise progress?")) return;
	try {
		localStorage.removeItem("sqljudge_progress");
	} catch {
		/* ignore */
	}
	loadExercises();
}

// _descriptions lives in state.ts

// ─── SQL.js helpers ────────────────────────────────────────────────────────
function runQuery(sql: string): any {
	try {
		const results = getState("db").exec(sql);
		if (!results || results.length === 0)
			return { ok: true, cols: [], rows: [], rowCount: 0 };
		const cols = results[0].columns;
		const rows = results[0].values.map((v: any[]) => {
			const row: Record<string, any> = {};
			cols.forEach((c: string, i: number) => {
				row[c] = v[i];
			});
			return row;
		});
		return { ok: true, cols, rows, rowCount: rows.length };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

function getSchema() {
	const tables = {};
	const tableRows = getState("db").exec(
		"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
	);
	if (!tableRows || tableRows.length === 0) return tables;
	const tableNames = tableRows[0].values.map((v: any[]) => v[0]);
	for (const t of tableNames) {
		const colResult = getState("db").exec("PRAGMA table_info('" + t + "')");
		const cols = colResult[0].values.map((v: any[]) => ({
			name: v[1],
			type: v[2],
			pk: !!v[5],
			notnull: !!v[3],
			default: v[4],
		}));
		const fkResult = getState("db").exec(
			"PRAGMA foreign_key_list('" + t + "')",
		);
		const fks =
			fkResult && fkResult.length
				? fkResult[0].values.map((v: any[]) => ({
						from: v[3],
						table: v[2],
						to: v[4],
					}))
				: [];
		tables[t] = { columns: cols, foreignKeys: fks };
	}
	return tables;
}

import { compareResults } from "./lib.ts";
import { getState, setState } from "./state";
import { expose, exposeState } from "./window";

// ─── Sidebar tabs ─────────────────────────────────────────────────────────
function showSidebar(panel: string): void {
	document
		.querySelectorAll(".sidebar-tab")
		.forEach((t) =>
			(t as HTMLElement).classList.toggle(
				"active",
				(t as HTMLElement).dataset.panel === panel,
			),
		);
	document
		.querySelectorAll(".sidebar-panel")
		.forEach((p) => p.classList.toggle("active", p.id === "panel-" + panel));
}

// ─── Sidebar resize ────────────────────────────────────────────────────────
function addSidebarResize(): void {
	const grip = document.getElementById("sidebarGrip");
	if (!grip) return;
	let isDragging = false;

	grip.addEventListener("mousedown", (e: MouseEvent) => {
		e.preventDefault();
		isDragging = true;
		grip.classList.add("dragging");
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";

		const onMove = (ev: MouseEvent) => {
			if (!isDragging) return;
			let w = ev.clientX;
			w = Math.max(280, Math.min(600, w));
			document.documentElement.style.setProperty("--sidebar-width", w + "px");
		};

		const onUp = () => {
			isDragging = false;
			grip.classList.remove("dragging");
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
			if (getState("cmEditor"))
				setTimeout(() => getState("cmEditor").refresh(), 0);
			if (getState("cmSandbox"))
				setTimeout(() => getState("cmSandbox").refresh(), 0);
		};

		const onBlur = () => {
			if (isDragging) onUp();
		};
		window.addEventListener("blur", onBlur);
		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	});
}

// ─── Load exercises ────────────────────────────────────────────────────────────────────
function loadExercises() {
	renderExercises();
}

function setFilter(filter: string): void {
	setState("currentFilter", filter);
	renderExercises();
}

function setSort(sort: string): void {
	if (sort === "default") {
		setState("currentSort", "default");
		setState("currentSortDir", "asc");
	} else if (sort === getState("currentSort")) {
		setState(
			"currentSortDir",
			getState("currentSortDir") === "asc" ? "desc" : "asc",
		);
	} else {
		setState("currentSort", sort);
		setState("currentSortDir", "asc");
	}
	renderExercises();
}

function renderExercises() {
	const list = document.getElementById("exerciseList");
	if (!list) return;
	// Save scroll position on the scrollable sidebar panel
	const panel = document.getElementById("panel-exercises");
	const savedScroll = panel ? panel.scrollTop : 0;

	// Custom database: no exercises, no controls
	if (getState("activeDbId") !== "unilever") {
		const exercises = [];
		list.innerHTML =
			'<div style="padding:20px;text-align:center;color:#8b949e;font-size:13px">📭 No exercises for this database.<br>Switch to <a href="#" onclick="switchMode(\'sandbox\');return false" style="color:#58a6ff">Sandbox mode</a> to run your own queries.</div>';
		return;
	}

	const exercises = getState("allExerciseDefs").map((e: any) => ({
		id: e.id,
		title: e.title,
		difficulty: e.difficulty,
	}));

	const progress = loadProgress();

	// Filter
	let filtered = exercises;
	if (getState("currentFilter") !== "all") {
		filtered = exercises.filter(
			(e) => e.difficulty === getState("currentFilter"),
		);
	}

	// Sort (stable — tied items keep original order)
	const sorted = [...filtered].sort((a, b) => {
		const dir =
			getState("currentSort") === "default"
				? 1
				: getState("currentSortDir") === "asc"
					? 1
					: -1;
		if (getState("currentSort") === "difficulty") {
			const order: Record<string, number> = {
				Easy: 1,
				Medium: 2,
				Hard: 3,
			};
			return dir * ((order[a.difficulty] || 0) - (order[b.difficulty] || 0));
		}
		if (getState("currentSort") === "progress") {
			return (
				dir *
				(getProgressWeight(progress[a.id]) - getProgressWeight(progress[b.id]))
			);
		}
		return 0; // "default" — keep original order
	});

	// Build HTML
	let html = `<div class="exercise-filter-bar">
    <div class="filter-btn${getState("currentFilter") === "all" ? " active" : ""}" onclick="setFilter('all')">All</div>
    <div class="filter-btn${getState("currentFilter") === "Easy" ? " active" : ""}" onclick="setFilter('Easy')">Easy</div>
    <div class="filter-btn${getState("currentFilter") === "Medium" ? " active" : ""}" onclick="setFilter('Medium')">Medium</div>
    <div class="filter-btn${getState("currentFilter") === "Hard" ? " active" : ""}" onclick="setFilter('Hard')">Hard</div>
  </div>
  <div class="exercise-sort-bar">
    <span class="sort-label">Sort:</span>
    <div class="sort-btn${getState("currentSort") === "default" ? " active" : ""}" onclick="setSort('default')">Default</div>
    <div class="sort-btn${getState("currentSort") === "difficulty" ? " active" : ""}" onclick="setSort('difficulty')">Difficulty${getState("currentSort") === "difficulty" ? (getState("currentSortDir") === "asc" ? " ↑" : " ↓") : ""}</div>
    <div class="sort-btn${getState("currentSort") === "progress" ? " active" : ""}" onclick="setSort('progress')">Progress${getState("currentSort") === "progress" ? (getState("currentSortDir") === "asc" ? " ↑" : " ↓") : ""}</div>
  </div>`;

	if (sorted.length === 0) {
		html +=
			'<div style="padding:20px;text-align:center;color:#8b949e;font-size:13px">🔍 No exercises match the filter.</div>';
	} else {
		for (const e of sorted) {
			const rec = progress[e.id];
			let cls = "exercise-item";
			if (rec && rec.passCount > 0) cls += " completed";
			else if (rec && rec.attemptCount > 0) cls += " failed";
			if (e.id === getState("currentId")) cls += " active";
			html += `<div class="${cls}" data-id="${escHtml(e.id)}" onclick="selectExercise('${escHtml(e.id)}')">
      <div class="title">${escHtml(e.title)}</div>
      <div class="meta"><span class="diff-badge diff-${escHtml(e.difficulty)}">${escHtml(e.difficulty)}</span>${escHtml(e.id)}</div>
    </div>`;
		}
	}

	list.innerHTML = html;
	// Restore scroll position on the scrollable sidebar panel
	if (panel) panel.scrollTop = savedScroll;
}

function selectExercise(id: string): void {
	setState("currentId", id);
	renderExercises();
	if (getState("currentMode") === "practice") loadPractice(id);
	else loadSandbox();
}

// ─── Mode switch ───────────────────────────────────────────────────────────
function switchMode(mode: string): void {
	setState("currentMode", mode as "practice" | "sandbox");
	document
		.getElementById("tabPractice")
		.classList.toggle("active", mode === "practice");
	document
		.getElementById("tabSandbox")
		.classList.toggle("active", mode === "sandbox");
	if (mode === "sandbox") loadSandbox();
	else if (getState("currentId")) loadPractice(getState("currentId"));
	else {
		document.getElementById("mainContent").innerHTML =
			'<div class="question" style="text-align:center;color:#8b949e;padding:60px 20px;"><h3>👈 Select an exercise</h3></div>';
	}
}

// ─── Initialize CodeMirror ─────────────────────────────────────────────────
function createEditor(containerId: string, initialValue: string): any {
	const textarea = document.createElement("textarea");
	textarea.value = initialValue || "";
	document.getElementById(containerId).appendChild(textarea);

	const editor = CodeMirror.fromTextArea(textarea, {
		mode: "text/x-sql",
		theme: "dracula",
		lineNumbers: true,
		indentWithTabs: true,
		smartIndent: true,
		lineWrapping: true,
		extraKeys: {
			"Ctrl-Space": "autocomplete",
			"Ctrl-Enter": () => {},
			"Cmd-Enter": () => {},
		},
		hintOptions: {
			completeSingle: false,
			tables: {},
		},
	});

	// Only resize the editor when the number of lines actually changes
	// (newlines, pasted multi-line text, or line merges from delete/backspace)
	editor.on("change", (cm, change) => {
		const oldLines = change.removed ? change.removed.split("\n").length : 1;
		const newLines = change.text.length;
		if (oldLines !== newLines) {
			cm.setSize(null, Math.max(120, cm.getScrollInfo().height + 10));
		}
	});

	editor.on("inputRead", (cm, change) => {
		if (change.text.length === 1 && /[a-zA-Z._]/.test(change.text[0])) {
			CodeMirror.commands.autocomplete(cm, null, {
				completeSingle: false,
			});
		}
	});

	return editor;
}

function getEditorValue(editor: any): string {
	return editor.getValue().trim();
}

function setEditorValue(editor: any, val: string): void {
	editor.setValue(val || "");
	// The change handler resizes on line-count changes, but we also resize
	// here to handle the case where content stays single-line (e.g. clear all)
	// and the editor needs to shrink back to minimum height.
	editor.setSize(null, Math.max(120, editor.getScrollInfo().height + 10));
	editor.focus();
}

// ─── Load Schema into autocomplete hints ───────────────────────────────────
function loadSchemaData() {
	if (getState("schemaData")) {
		refreshEditorHints();
		return;
	}
	setState("schemaData", getSchema());
	refreshEditorHints();
}

function refreshEditorHints(): void {
	const tables: Record<string, string[]> = {};
	if (getState("schemaData")) {
		for (const [name, info] of Object.entries(getState("schemaData"))) {
			tables[name] = (info as any).columns.map((c: any) => c.name);
		}
	}
	const hintCfg = { tables, completeSingle: false };
	if (getState("cmEditor"))
		getState("cmEditor").setOption("hintOptions", hintCfg);
	if (getState("cmSandbox"))
		getState("cmSandbox").setOption("hintOptions", hintCfg);
}

// ─── Schema viewer (tables cards) ──────────────────────────────────────────
function renderTableCards() {
	if (!getState("schemaData")) return;
	const container = document.getElementById("sv-cards");
	let html = '<div class="table-cards">';

	const tableOrder = [
		"NHOM_HANG",
		"LOAI_NV",
		"HINH_THUC_DONG_GOI",
		"DOI",
		"DAI_LY",
		"NHAN_VIEN",
		"HANG_HOA",
		"PHIEU_XUAT",
		"CTPX",
		"HOA_DON",
		"CTHD",
	];

	for (const t of tableOrder) {
		const info = getState("schemaData")[t];
		if (!info) continue;
		const pkNames = info.columns.filter((c) => c.pk).map((c) => c.name);
		const pkStr = pkNames.join(", ");

		html += `<div class="table-card">
      <div class="table-card-header" onclick="this.nextElementSibling.classList.toggle('collapsed')">
        <span>${t} <span class="badge">(${info.columns.length})</span></span>
        <span style="font-size:10px;color:#8b949e">PK: ${pkStr}</span>
      </div>
      <div class="table-card-body">`;

		for (const c of (info as any).columns) {
			html += `<div class="schema-col${c.pk ? " pk" : ""}">
        ${
					c.pk
						? '<span class="col-pk">🔑</span>'
						: '<span style="color:#30363d">·</span>'
				}
        <span class="col-name">${c.name}</span>
        <span class="col-type">${c.type.toLowerCase()}</span>
        ${
					c.notnull
						? '<span style="color:#f0883e;font-size:9px">NOT NULL</span>'
						: ""
				}
        ${
					c.default
						? '<span style="color:#8b949e;font-size:9px">DEFAULT ' +
							c.default +
							"</span>"
						: ""
				}
      </div>`;
		}

		for (const fk of info.foreignKeys) {
			html += `<div class="schema-fk">↳ ${fk.from} → ${fk.table}(${fk.to})</div>`;
		}

		html += `</div></div>`;
	}

	html += "</div>";
	container.innerHTML = html;
}

// ─── Schema viewer (ER diagram) ────────────────────────────────────────────
// Hybrid approach:
//   - Preset DB (Unilever) → static pre-rendered SVG (zero JS cost)
//   - Custom DB            → lazy-load mermaid.js on demand

// ─── Render Description tab ───────────────────────────────────────────────
function renderDescription(): void {
	const container = document.getElementById("bv-desc");
	if (!container || !getState("_descriptions")) return;
	let html = '<div style="padding:12px">';
	for (const [name, info] of Object.entries(getState("_descriptions"))) {
		html += `<details style="margin-bottom:8px;background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px 12px">
      <summary style="cursor:pointer;font-weight:600;color:#e6edf3;font-size:13px">${escHtml(name)}</summary>
      <p style="margin:8px 0 4px;font-size:12px;color:#8b949e;line-height:1.5">${escHtml(info.description)}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:11px">
        <thead><tr style="background:#0d1117"><th style="padding:3px 6px;text-align:left;color:#8b949e">Column</th><th style="padding:3px 6px;text-align:left;color:#8b949e">Description</th></tr></thead>
        <tbody>`;
		for (const [col, desc] of Object.entries(info.columns)) {
			const isPk =
				getState("schemaData") &&
				getState("schemaData")[name]?.columns?.some(
					(c: any) => c.name === col && c.pk,
				);
			const isFk =
				getState("schemaData") &&
				getState("schemaData")[name]?.foreignKeys?.some(
					(f: any) => f.from === col,
				);
			let colDisplay = escHtml(col);
			if (isPk) colDisplay = "🔑 " + colDisplay;
			if (isFk) colDisplay = "↳ " + colDisplay;
			html += `<tr style="border-top:1px solid #21262d"><td style="padding:3px 6px;color:#79c0ff;font-family:monospace">${colDisplay}</td><td style="padding:3px 6px;color:#c9d1d9">${escHtml(desc)}</td></tr>`;
		}
		html += "</tbody></table></details>";
	}
	html += "</div>";
	container.innerHTML = html;
}

function renderERDiagram() {
	if (!getState("schemaData")) {
		const container = document.getElementById("mermaidContainer");
		if (container)
			container.innerHTML =
				'<div style="color:#8b949e;padding:20px;text-align:center">No tables to diagram.</div>';
		return;
	}
	if (Object.keys(getState("schemaData")).length === 0) {
		const container = document.getElementById("mermaidContainer");
		if (container)
			container.innerHTML =
				'<div style="color:#8b949e;padding:20px;text-align:center">No tables found.</div>';
		return;
	}

	const container = document.getElementById("mermaidContainer");
	if (!container) return;

	// Preset database — serve static pre-rendered SVG
	if (getState("activeDbId") === "unilever") {
		container.innerHTML =
			'<div style="text-align:center"><img src="db/Unilever_Product_Management.er.svg" alt="Entity-relationship diagram of the Unilever Product Management database showing 11 tables and their foreign key relationships" style="max-width:100%;height:auto" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'" /><div style="display:none;color:#ff7b72;padding:20px;text-align:center">ER diagram image not available. Run <code>npm run build:er</code> to generate it.</div></div>';
		return;
	}

	// Custom database — lazy-load mermaid on demand
	doRenderMermaid(container);
}

function doRenderMermaid(container: HTMLElement): void {
	if (typeof mermaid === "undefined" && !getState("_mermaidLoading")) {
		container.innerHTML =
			'<div style="color:#8b949e;padding:20px;text-align:center">⏳ Loading diagram renderer...</div>';

		setState("_mermaidLoading", true);
		const script = document.createElement("script");
		script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
		script.onload = () => {
			setState("_mermaidLoading", false);
			mermaid.initialize({ theme: "dark", startOnLoad: false });
			renderMermaidFromSchema(container);
		};
		script.onerror = () => {
			setState("_mermaidLoading", false);
			container.innerHTML =
				'<div style="color:#ff7b72;padding:20px;">Failed to load ER diagram renderer from CDN.</div>';
		};
		document.head.appendChild(script);
	} else if (typeof mermaid !== "undefined") {
		renderMermaidFromSchema(container);
	}
	// If _mermaidLoading is true, the loading message is already shown; do nothing
}

function renderMermaidFromSchema(container: HTMLElement): void {
	let mmd = "erDiagram\n";

	for (const [name, info] of Object.entries(getState("schemaData"))) {
		mmd += `  ${escHtml(name)} {\n`;
		for (const c of info.columns) {
			const cType = c.type.toLowerCase().replace(/\(.*/, "");
			const tags = [];
			if (c.pk) tags.push("PK");
			if (info.foreignKeys.some((f) => f.from === c.name)) tags.push("FK");
			const tagStr = tags.length > 0 ? " " + tags.join(", ") : "";
			mmd += `    ${escHtml(cType)} ${escHtml(c.name)}${tagStr}\n`;
		}
		mmd += "  }\n";
	}

	mmd += "\n";
	for (const [name, info] of Object.entries(getState("schemaData"))) {
		for (const fk of info.foreignKeys) {
			mmd += `  ${escHtml(fk.table)} ||--o{ ${escHtml(name)} : "${escHtml(fk.from)} → ${escHtml(fk.table)}.${escHtml(fk.to)}"\n`;
		}
	}

	container.innerHTML =
		'<div class="mermaid" style="text-align:center">' + escHtml(mmd) + "</div>";

	const el = container.querySelector(".mermaid") as HTMLElement | null;
	if (el) {
		mermaid.run({ nodes: [el as Element] }).catch((e: any) => {
			container.innerHTML =
				'<div style="color:#ff7b72;padding:20px;">ER diagram render error: ' +
				e.message +
				"</div>";
		});
	}
}

function showSchemaView(view: string): void {
	document
		.querySelectorAll(".schema-tab")
		.forEach((t) =>
			(t as HTMLElement).classList.toggle(
				"active",
				(t as HTMLElement).dataset.stab === view,
			),
		);
	document
		.querySelectorAll(".schema-view")
		.forEach((s) => s.classList.toggle("active", s.id === "sv-" + view));
}

// ─── Bottom panel ──────────────────────────────────────────────────────────
function showBottomView(view: string): void {
	document
		.querySelectorAll(".bottom-tab")
		.forEach((t) =>
			(t as HTMLElement).classList.toggle(
				"active",
				(t as HTMLElement).dataset.bview === view,
			),
		);
	document
		.querySelectorAll(".bottom-view")
		.forEach((v) => v.classList.toggle("active", v.id === "bv-" + view));
	if (view === "er" && getState("schemaData")) {
		setTimeout(() => renderERDiagram(), 100);
	}
	if (view === "checks" && getState("schemaData")) {
		// checks may have missed init render; safe to re-call
		const container = document.getElementById("bv-checks");
		if (container && !container.innerHTML) renderChecks();
	}
	if (view === "desc" && getState("_descriptions")) {
		renderDescription();
	}
}

function toggleBottomPanel(): void {
	const panel = document.getElementById("bottomPanel");
	if (!panel) return;
	const isCollapsed = panel.classList.toggle("collapsed");
	if (isCollapsed) {
		// Store current height on panel dataset before clearing, so we can restore on expand
		if (panel.style.height && panel.style.height !== "auto")
			panel.dataset.prevHeight = panel.style.height;
		panel.style.height = "";
	} else {
		// Restore previous height or default to 22% viewport
		const prev = panel.dataset.prevHeight;
		panel.style.height = prev || Math.round(window.innerHeight * 0.22) + "px";
		if (getState("schemaData")) setTimeout(() => renderERDiagram(), 50);
	}
	if (getState("cmEditor"))
		setTimeout(() => getState("cmEditor").refresh(), 50);
	if (getState("cmSandbox"))
		setTimeout(() => getState("cmSandbox").refresh(), 50);
}

function loadSchema() {
	if (!getState("schemaData")) {
		setState("schemaData", getSchema());
		renderTableCards();
		refreshEditorHints();
	}
}

// ─── Render Checks tab ─────────────────────────────────────────────────────
function renderChecks(): void {
	const container = document.getElementById("bv-checks");
	if (!container || !getState("schemaData")) return;
	let html = '<div class="table-cards">';
	for (const [name, info] of Object.entries(getState("schemaData"))) {
		const pkNames = (info as any).columns
			.filter((c: any) => c.pk)
			.map((c: any) => c.name);
		const notNullCols = (info as any).columns
			.filter((c: any) => c.notnull)
			.map((c: any) => c.name);
		const fkCount = (info as any).foreignKeys.length;

		html += `<div class="table-card">
      <div class="table-card-header" onclick="this.nextElementSibling.classList.toggle('collapsed')">
        <span>${name}</span>
        <span style="font-size:10px;color:#8b949e">${(info as any).columns.length} cols</span>
      </div>
      <div class="table-card-body">
        <div class="schema-col"><span class="col-name">Primary Key:</span><span class="col-type">${pkNames.join(", ") || "None"}</span></div>
        <div class="schema-col"><span class="col-name">NOT NULL:</span><span class="col-type">${notNullCols.length > 0 ? notNullCols.join(", ") : "None"}</span></div>
        <div class="schema-col"><span class="col-name">Foreign Keys:</span><span class="col-type">${fkCount > 0 ? fkCount + " relationship(s)" : "None"}</span></div>
      </div></div>`;
	}
	html += "</div>";
	container.innerHTML = html;
}

// ─── Bottom panel vertical resize (drag anywhere on the bottom bar) ───────
function addBottomResize(): void {
	const bar = document.getElementById("bottomBar");
	const panel = document.getElementById("bottomPanel");
	if (!bar || !panel) return;
	let isDragging = false;
	let startY = 0;
	let startHeight = 0;

	bar.addEventListener("mousedown", (e: MouseEvent) => {
		if (panel.classList.contains("collapsed")) return;
		startY = e.clientY;
		startHeight = panel.offsetHeight;
		isDragging = true;
		document.body.style.cursor = "ns-resize";
		document.body.style.userSelect = "none";

		const onMove = (ev: MouseEvent) => {
			if (!isDragging) return;
			const delta = startY - ev.clientY;
			let h = startHeight + delta;
			const topbar = document.querySelector(".topbar") as HTMLElement | null;
			const topbarHeight = topbar ? topbar.offsetHeight : 60;
			const available = window.innerHeight - topbarHeight;
			const MIN_CONTENT = 120;
			const maxH = Math.max(32, available - MIN_CONTENT);
			h = Math.max(32, Math.min(maxH, h));
			panel.style.height = h + "px";
		};

		const onBlur = () => {
			if (isDragging) onUp();
		};

		const onUp = () => {
			isDragging = false;
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
			window.removeEventListener("blur", onBlur);
			clearTimeout(getState("_bottomResizeTimer"));
			setState(
				"_bottomResizeTimer",
				setTimeout(() => {
					if (getState("schemaData")) renderERDiagram();
				}, 300),
			);
		};

		window.addEventListener("blur", onBlur);
		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	});
}

// ─── Practice Mode ─────────────────────────────────────────────────────────
function loadPractice(id: string): void {
	const ex = getState("allExerciseDefs").find((e) => e.id === id);
	if (!ex) return;
	document.getElementById("mainTitle").textContent = ex.title;

	const content = document.getElementById("mainContent");
	content.innerHTML = `
    <div class="question">
      <h3>📋 Question</h3>
      <p>${ex.question}</p>
      <div class="tables">Tables: ${ex.tables
				.map((t: string) => "<span>" + t + "</span>")
				.join("")}</div>
    </div>
    <div class="sql-section" id="editorContainer">
      <div class="sql-actions">
        <button class="btn btn-primary" id="runBtn" onclick="runJudge()">▶ Run</button>
        <button class="btn btn-secondary" onclick="setEditorValue(cmEditor, '')">Clear</button>
        <button class="btn btn-secondary" onclick="setEditorValue(cmEditor, sessionStorage.getItem('lastQuery_${id}') || '')">Restore</button>
        <span class="status" id="status"></span>
      </div>
    </div>
    <div id="results"></div>`;

	if (getState("cmEditor")) {
		getState("cmEditor").toTextArea();
		setState("cmEditor", null);
	}
	const last = sessionStorage.getItem("lastQuery_" + id) || "";
	setState("cmEditor", createEditor("editorContainer", last));
	const actions = content.querySelector(".sql-actions");
	content
		.querySelector("#editorContainer")
		.insertBefore(
			content.querySelector("#editorContainer .CodeMirror"),
			actions,
		);

	getState("cmEditor").setOption("extraKeys", {
		"Ctrl-Space": "autocomplete",
		"Ctrl-Enter": () => runJudge(),
		"Cmd-Enter": () => runJudge(),
	});

	if (getState("schemaData")) {
		getState("cmEditor").setOption("hintOptions", {
			tables: buildTableHints(),
			completeSingle: false,
		});
	}

	getState("cmEditor").focus();
}

// ─── Sandbox Mode ──────────────────────────────────────────────────────────
function loadSandbox() {
	document.getElementById("mainTitle").textContent =
		"🔧 Sandbox — Free Query Mode";
	const content = document.getElementById("mainContent");
	content.innerHTML = `
    <div class="sandbox-note">Run any SQL query. No judging — just results.</div>
    <div class="sql-section" id="sandboxContainer">
      <div class="sql-actions">
        <button class="btn btn-primary" id="sandboxRunBtn" onclick="runSandbox()">▶ Run</button>
        <button class="btn btn-secondary" onclick="setEditorValue(cmSandbox, '')">Clear</button>
        <span class="status" id="sandboxStatus"></span>
      </div>
    </div>
    <div id="sandboxResults"></div>`;

	if (getState("cmSandbox")) {
		getState("cmSandbox").toTextArea();
		setState("cmSandbox", null);
	}
	setState(
		"cmSandbox",
		createEditor("sandboxContainer", "SELECT * FROM HANG_HOA LIMIT 5;"),
	);
	const actions = content.querySelector(".sql-actions");
	content
		.querySelector("#sandboxContainer")
		.insertBefore(
			content.querySelector("#sandboxContainer .CodeMirror"),
			actions,
		);

	getState("cmSandbox").setOption("extraKeys", {
		"Ctrl-Space": "autocomplete",
		"Ctrl-Enter": () => runSandbox(),
		"Cmd-Enter": () => runSandbox(),
	});

	if (getState("schemaData")) {
		getState("cmSandbox").setOption("hintOptions", {
			tables: buildTableHints(),
			completeSingle: false,
		});
	}

	getState("cmSandbox").focus();
}

// ─── Build table hints from schema ─────────────────────────────────────────
function buildTableHints() {
	if (!getState("schemaData")) return {};
	const tables = {};
	for (const [name, info] of Object.entries(getState("schemaData"))) {
		tables[name] = info.columns.map((c) => c.name);
		tables[name.toLowerCase()] = info.columns.map((c) => c.name);
	}
	return tables;
}

// ─── Judge (client-side) ───────────────────────────────────────────────────
function runJudge() {
	const query = getEditorValue(getState("cmEditor"));
	if (!query) return;
	sessionStorage.setItem("lastQuery_" + getState("currentId"), query);

	const ex = getState("allExerciseDefs").find(
		(e) => e.id === getState("currentId"),
	);
	if (!ex) return;

	const btn = document.getElementById("runBtn") as HTMLButtonElement;
	const status = document.getElementById("status");
	btn.disabled = true;
	status.textContent = "⏳ Running...";

	setTimeout(() => {
		const user = runQuery(query);
		const ref = runQuery(ex.solution);
		const result = compareResults(user, ref);
		renderJudgeResults({
			pass: result.pass,
			issues: result.issues,
			user: user.ok
				? {
						cols: user.cols,
						rows: user.rows.slice(0, 50),
						rowCount: user.rowCount,
					}
				: { error: user.error },
			ref: ref.ok
				? {
						cols: ref.cols,
						rows: ref.rows.slice(0, 50),
						rowCount: ref.rowCount,
					}
				: null,
			solution: ex.solution,
			hint: ex.hint || null,
		});
		recordAttempt(getState("currentId")!, result.pass);
		btn.disabled = false;
		status.textContent = "";
	}, 50);
}

function renderJudgeResults(data: any): void {
	const el = document.getElementById("results");
	let html = '<div class="results">';

	if (data.pass) {
		html += `<div class="result-box"><div class="result-header pass">✅ PASS — Your query is correct!</div></div>`;
	} else {
		html += `<div class="result-box"><div class="result-header fail">❌ FAIL — ${data.issues.length} issue(s)</div>`;
		html += `<div class="issues"><ul>${data.issues
			.map((i: string) => "<li>" + escHtml(i) + "</li>")
			.join("")}</ul></div>`;
		if (data.hint) html += `<div class="hint">💡 ${escHtml(data.hint)}</div>`;
		html += `</div>`;
	}

	html += `<div class="solution">
    <div class="solution-header" onclick="this.nextElementSibling.classList.toggle('open')">
      📖 Reference solution ${data.pass ? "(yours matches)" : ""} ▾
    </div>
    <div class="solution-body">${escHtml(data.solution)}</div>
  </div>`;

	if (data.user && !data.user.error) {
		html += resultTable(
			"📊 Your result",
			data.user.cols,
			data.user.rows,
			data.user.rowCount,
		);
	} else if (data.user && data.user.error) {
		html += `<div class="result-box"><div class="result-header fail">⚠️ ${escHtml(data.user.error)}</div></div>`;
	}
	if (data.ref) {
		html += resultTable(
			"📖 Expected result",
			data.ref.cols,
			data.ref.rows,
			data.ref.rowCount,
		);
	}
	html += "</div>";
	el.innerHTML = html;
}

// ─── Sandbox query ─────────────────────────────────────────────────────────
function runSandbox() {
	const query = getEditorValue(getState("cmSandbox"));
	if (!query) return;
	const btn = document.getElementById("sandboxRunBtn") as HTMLButtonElement;
	const status = document.getElementById("sandboxStatus");
	btn.disabled = true;
	status.textContent = "⏳ Running...";

	setTimeout(() => {
		const result = runQuery(query);
		if (result.ok) {
			document.getElementById("sandboxResults").innerHTML = resultTable(
				"📊 " + result.rowCount + " row(s)",
				result.cols,
				result.rows,
				result.rowCount,
			);
		} else {
			document.getElementById("sandboxResults").innerHTML =
				`<div class="result-box"><div class="result-header fail">⚠️ ${escHtml(result.error)}</div></div>`;
		}
		btn.disabled = false;
		status.textContent = "";
	}, 50);
}

// ─── Database management (client-side) ─────────────────────────────────────

function updateDbStatusUI() {
	document.getElementById("dbName").textContent = getState("activeDbName");
	document.getElementById("dbBadge").className =
		"db-badge" + (getState("activeDbId") === "custom" ? " custom" : "");
	document.getElementById("resetBtn").style.display =
		getState("activeDbId") === "custom" ? "" : "none";
}

function showLoadSqlModal() {
	document.getElementById("sqlModal").classList.add("open");
	(document.getElementById("sqlText") as HTMLTextAreaElement).value = "";
	(document.getElementById("sqlDbName") as HTMLInputElement).value = "";
	(document.getElementById("sqlFileInput") as HTMLInputElement).value = "";
	document.getElementById("loadSqlError").textContent = "";
	document.getElementById("loadSqlStatus").textContent = "";
	document.getElementById("sqlText").focus();

	(document.getElementById("sqlFileInput") as HTMLInputElement).onchange =
		function (this: HTMLInputElement) {
			const file = this.files![0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = (e: ProgressEvent<FileReader>) => {
				(document.getElementById("sqlText") as HTMLTextAreaElement).value = e
					.target?.result as string;
				document.getElementById("loadSqlStatus").textContent =
					"📄 Loaded " + file.name;
			};
			reader.readAsText(file);
		};
}

function closeLoadSqlModal() {
	document.getElementById("sqlModal").classList.remove("open");
}

function loadSqlFromText() {
	const sql = (
		document.getElementById("sqlText") as HTMLTextAreaElement
	).value.trim();
	if (!sql) {
		document.getElementById("loadSqlError").textContent =
			"Please paste SQL or upload a .sql file.";
		return;
	}
	const name =
		(document.getElementById("sqlDbName") as HTMLInputElement).value.trim() ||
		"Custom Database";
	const btn = document.querySelector(
		"#sqlModal .btn-primary",
	) as HTMLButtonElement;
	const status = document.getElementById("loadSqlStatus");
	const errorEl = document.getElementById("loadSqlError");
	errorEl.textContent = "";
	btn.disabled = true;
	status.textContent = "⏳ Loading...";

	setTimeout(() => {
		try {
			const newDb = new (getState("SQL").Database)();
			newDb.run("PRAGMA foreign_keys = ON");
			newDb.run(sql);
			setState("db", newDb);
			setState("activeDbName", name);
			setState("activeDbId", "custom");
			setState("currentFilter", "all");
			setState("currentSort", "default");
			setState("currentSortDir", "asc");

			closeLoadSqlModal();
			setState("schemaData", null);
			setState("cmEditor", null);
			setState("cmSandbox", null);
			setState("currentId", null);
			updateDbStatusUI();

			const content = document.getElementById("mainContent");
			content.innerHTML =
				'<div class="question" style="text-align:center;color:#8b949e;padding:60px 20px;"><h3>✅ Database loaded: ' +
				escHtml(name) +
				'</h3><p style="margin-top:8px;font-size:13px;color:#8b949e">Use Sandbox mode to run queries.</p></div>';
			document.getElementById("mainTitle").textContent = name;
			document
				.querySelectorAll(".exercise-item")
				.forEach((el) => el.classList.remove("active"));
			setState("schemaData", getSchema());
			loadExercises();
			renderTableCards();
			renderERDiagram();
			renderChecks();
			refreshEditorHints();
		} catch (e) {
			errorEl.textContent = "SQL error: " + e.message;
		}
		btn.disabled = false;
		status.textContent = "";
	}, 50);
}

async function resetDatabase() {
	const res = await fetch("db/Unilever_Product_Management.db");
	const buffer = await res.arrayBuffer();
	setState("db", new (getState("SQL").Database)(new Uint8Array(buffer)));
	setState("activeDbName", "Unilever Product Management");
	setState("activeDbId", "unilever");
	setState("currentFilter", "all");
	setState("currentSort", "default");
	setState("currentSortDir", "asc");

	setState("schemaData", null);
	setState("cmEditor", null);
	setState("cmSandbox", null);
	setState("currentId", null);
	updateDbStatusUI();
	document.getElementById("mainTitle").textContent =
		"Unilever Product Management";
	document.getElementById("mainContent").innerHTML =
		'<div class="question" style="text-align:center;color:#8b949e;padding:60px 20px;"><h3>👈 Select an exercise from the sidebar</h3></div>';
	document
		.querySelectorAll(".exercise-item")
		.forEach((el) => el.classList.remove("active"));
	setState("schemaData", getSchema());
	loadExercises();
	renderTableCards();
	renderERDiagram();
	renderChecks();
	refreshEditorHints();
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function escHtml(s: unknown): string {
	return String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function resultTable(
	label: string,
	cols: string[],
	rows: Record<string, any>[],
	rowCount: number,
): string {
	let html =
		'<div class="result-box"><div class="result-header">' +
		label +
		" — " +
		rowCount +
		' row(s)</div><div class="result-body"><table><thead><tr>';
	for (const c of cols) html += "<th>" + escHtml(c) + "</th>";
	html += "</tr></thead><tbody>";
	for (const r of rows) {
		html += "<tr>";
		for (const c of cols)
			html +=
				"<td>" +
				(r[c] === null
					? '<span style="color:#8b949e">NULL</span>'
					: escHtml(String(r[c]))) +
				"</td>";
		html += "</tr>";
	}
	html += "</tbody></table></div></div>";
	return html;
}

// ─── Init ──────────────────────────────────────────────────────────────────

// ─── Window exposure ──────────────────────────────────────────────
expose("selectExercise", selectExercise);
expose("switchMode", switchMode);
expose("showSidebar", showSidebar);
expose("showSchemaView", showSchemaView);
expose("showBottomView", showBottomView);
expose("showLoadSqlModal", showLoadSqlModal);
expose("closeLoadSqlModal", closeLoadSqlModal);
expose("loadSqlFromText", loadSqlFromText);
expose("resetDatabase", resetDatabase);
expose("resetProgress", resetProgress);
expose("loadSchema", loadSchema);
expose("runJudge", runJudge);
expose("runSandbox", runSandbox);
expose("setEditorValue", setEditorValue);
expose("toggleBottomPanel", toggleBottomPanel);
expose("setFilter", setFilter);
expose("setSort", setSort);
exposeState("cmEditor", () => getState("cmEditor"));
exposeState("cmSandbox", () => getState("cmSandbox"));

async function init() {
	// Load version badge and exercises concurrently (independent of WASM/DB)
	await Promise.all([
		(async () => {
			try {
				const vRes = await fetch("VERSION");
				document.getElementById("versionBadge").textContent =
					"v" + (await vRes.text()).trim();
			} catch {
				/* VERSION fetch is best-effort */
			}
		})(),
		(async () => {
			try {
				const exRes = await fetch("exercises/exercises.json");
				setState("allExerciseDefs", await exRes.json());
			} catch {
				/* exercises fetch is best-effort */
			}
		})(),
		(async () => {
			try {
				const dRes = await fetch(
					"db/Unilever_Product_Management.descriptions.json",
				);
				setState("_descriptions", await dRes.json());
			} catch {
				/* descriptions fetch is best-effort */
			}
		})(),
	]);

	// Initialize sql.js (loads WASM from CDN)
	try {
		setState(
			"SQL",
			await initSqlJs({
				locateFile: (file) => "vendor/" + file,
			}),
		);
	} catch (e) {
		document.getElementById("mainContent").innerHTML =
			'<div class="question" style="text-align:center;color:#ff7b72;padding:60px 20px;"><h3>❌ Failed to load SQL engine: ' +
			escHtml(e.message) +
			"</h3></div>";
		return;
	}

	// Load default database from binary .db file
	try {
		const dbRes = await fetch("db/Unilever_Product_Management.db");
		const dbBuffer = await dbRes.arrayBuffer();
		setState("db", new (getState("SQL").Database)(new Uint8Array(dbBuffer)));
	} catch (e) {
		document.getElementById("mainContent").innerHTML =
			'<div class="question" style="text-align:center;color:#ff7b72;padding:60px 20px;"><h3>❌ Failed to load database: ' +
			escHtml(e.message) +
			"</h3></div>";
		return;
	}

	updateDbStatusUI();
	setState("schemaData", getSchema());
	renderTableCards();
	renderERDiagram();
	renderChecks();
	loadExercises();
	refreshEditorHints();
	addSidebarResize();
	addBottomResize();

	// Set initial bottom panel height to ~22% of viewport (VS Code terminal default)
	const bottomPanel = document.getElementById("bottomPanel");
	if (bottomPanel) {
		const targetHeight = Math.round(window.innerHeight * 0.22);
		bottomPanel.style.height = targetHeight + "px";
		// Safety guard: if panel collapsed or height is too small, restore it
		setTimeout(() => {
			if (
				!bottomPanel.classList.contains("collapsed") &&
				bottomPanel.offsetHeight < targetHeight * 0.3
			) {
				bottomPanel.style.height = targetHeight + "px";
			}
		}, 300);
	}
}

init().catch((e) => {
	console.error(e);
});
