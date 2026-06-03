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
let db: any = null;
let SQL: any = null;
let exercises: { id: string; title: string; difficulty: string }[] = [];
let currentId: string | null = null;
let currentMode: "practice" | "sandbox" = "practice";
let schemaData: Record<string, any> | null = null;
let cmEditor: any = null;
let cmSandbox: any = null;
let activeDbName = "Unilever Product Management";
let activeDbId = "unilever";
let allExerciseDefs: any[] = [];
let _bottomResizeTimer: any = null;
let _mermaidLoading = false;

// ─── SQL.js helpers ────────────────────────────────────────────────────────
function runQuery(sql: string): any {
	try {
		const results = db.exec(sql);
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
	const tableRows = db.exec(
		"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
	);
	if (!tableRows || tableRows.length === 0) return tables;
	const tableNames = tableRows[0].values.map((v: any[]) => v[0]);
	for (const t of tableNames) {
		const colResult = db.exec("PRAGMA table_info('" + t + "')");
		const cols = colResult[0].values.map((v: any[]) => ({
			name: v[1],
			type: v[2],
			pk: !!v[5],
			notnull: !!v[3],
			default: v[4],
		}));
		const fkResult = db.exec("PRAGMA foreign_key_list('" + t + "')");
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

function normalizeValue(v: unknown): string {
	if (v === null || v === undefined) return "";
	if (typeof v === "number") return String(Math.round(v * 1e9) / 1e9);
	return String(v).trim();
}

function compareResults(
	user: any,
	ref: any,
): { pass: boolean; issues: string[] } {
	const issues = [];
	if (!user.ok) {
		return { pass: false, issues: ["Query failed: " + user.error] };
	}
	if (!ref.ok) {
		return {
			pass: false,
			issues: ["Reference query failed: " + ref.error],
		};
	}
	if (user.cols.length !== ref.cols.length) {
		issues.push(
			"Expected " +
				ref.cols.length +
				" column(s) [" +
				ref.cols.join(", ") +
				"], got " +
				user.cols.length +
				" [" +
				user.cols.join(", ") +
				"]",
		);
	}
	const userLower = user.cols.map((c) => c.toLowerCase());
	const refLower = ref.cols.map((c) => c.toLowerCase());
	for (let i = 0; i < Math.min(user.cols.length, ref.cols.length); i++) {
		if (userLower[i] !== refLower[i]) {
			issues.push(
				"Column " +
					(i + 1) +
					': expected "' +
					ref.cols[i] +
					'", got "' +
					user.cols[i] +
					'"',
			);
		}
	}
	if (user.rowCount !== ref.rowCount) {
		issues.push("Expected " + ref.rowCount + " row(s), got " + user.rowCount);
	}
	const colCount = Math.min(user.cols.length, ref.cols.length);
	const userSet = new Set(
		user.rows.map((r) =>
			user.cols
				.slice(0, colCount)
				.map((c) => normalizeValue(r[c]))
				.join("||"),
		),
	);
	const refSet = new Set(
		ref.rows.map((r) =>
			ref.cols
				.slice(0, colCount)
				.map((c) => normalizeValue(r[c]))
				.join("||"),
		),
	);
	const missing = [...refSet].filter((k) => !userSet.has(k));
	const extra = [...userSet].filter((k) => !refSet.has(k));
	if (missing.length > 0 || extra.length > 0) {
		issues.push(
			missing.length + " missing row(s), " + extra.length + " extra row(s)",
		);
	}
	return { pass: issues.length === 0, issues };
}

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
			if (cmEditor) setTimeout(() => cmEditor.refresh(), 0);
			if (cmSandbox) setTimeout(() => cmSandbox.refresh(), 0);
		};

		const onBlur = () => {
			if (isDragging) onUp();
		};
		window.addEventListener("blur", onBlur);
		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	});
}

// ─── Load exercises ────────────────────────────────────────────────────────
function loadExercises() {
	if (activeDbId !== "unilever") {
		exercises = [];
		document.getElementById("exerciseList").innerHTML =
			'<div style="padding:20px;text-align:center;color:#8b949e;font-size:13px">📭 No exercises for this database.<br>Switch to <a href="#" onclick="switchMode(\'sandbox\');return false" style="color:#58a6ff">Sandbox mode</a> to run your own queries.</div>';
		return;
	}
	exercises = allExerciseDefs.map((e: any) => ({
		id: e.id,
		title: e.title,
		difficulty: e.difficulty,
	}));
	document.getElementById("exerciseList").innerHTML = exercises
		.map(
			(e: any) =>
				`<div class="exercise-item" data-id="${e.id}" onclick="selectExercise('${e.id}')">
      <div class="title">${e.title}</div>
      <div class="meta"><span class="diff-badge diff-${e.difficulty}">${e.difficulty}</span>${e.id}</div>
    </div>`,
		)
		.join("");
}

function selectExercise(id: string): void {
	currentId = id;
	document
		.querySelectorAll(".exercise-item")
		.forEach((el) =>
			(el as HTMLElement).classList.toggle(
				"active",
				(el as HTMLElement).dataset.id === id,
			),
		);
	if (currentMode === "practice") loadPractice(id);
	else loadSandbox();
}

// ─── Mode switch ───────────────────────────────────────────────────────────
function switchMode(mode: string): void {
	currentMode = mode as "practice" | "sandbox";
	document
		.getElementById("tabPractice")
		.classList.toggle("active", mode === "practice");
	document
		.getElementById("tabSandbox")
		.classList.toggle("active", mode === "sandbox");
	if (mode === "sandbox") loadSandbox();
	else if (currentId) loadPractice(currentId);
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

	editor.on("change", () => {
		editor.setSize(null, Math.max(120, editor.getScrollInfo().height + 10));
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
	editor.setSize(null, Math.max(120, editor.getScrollInfo().height + 10));
	editor.focus();
}

// ─── Load Schema into autocomplete hints ───────────────────────────────────
function loadSchemaData() {
	if (schemaData) {
		refreshEditorHints();
		return;
	}
	schemaData = getSchema();
	refreshEditorHints();
}

function refreshEditorHints(): void {
	const tables: Record<string, string[]> = {};
	if (schemaData) {
		for (const [name, info] of Object.entries(schemaData)) {
			tables[name] = (info as any).columns.map((c: any) => c.name);
		}
	}
	const hintCfg = { tables, completeSingle: false };
	if (cmEditor) cmEditor.setOption("hintOptions", hintCfg);
	if (cmSandbox) cmSandbox.setOption("hintOptions", hintCfg);
}

// ─── Schema viewer (tables cards) ──────────────────────────────────────────
function renderTableCards() {
	if (!schemaData) return;
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
		const info = schemaData[t];
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

function renderERDiagram() {
	if (!schemaData) {
		const container = document.getElementById("mermaidContainer");
		if (container)
			container.innerHTML =
				'<div style="color:#8b949e;padding:20px;text-align:center">No tables to diagram.</div>';
		return;
	}
	if (Object.keys(schemaData).length === 0) {
		const container = document.getElementById("mermaidContainer");
		if (container)
			container.innerHTML =
				'<div style="color:#8b949e;padding:20px;text-align:center">No tables found.</div>';
		return;
	}

	const container = document.getElementById("mermaidContainer");
	if (!container) return;

	// Preset database — serve static pre-rendered SVG
	if (activeDbId === "unilever") {
		container.innerHTML =
			'<div style="text-align:center"><img src="db/Unilever_Product_Management.er.svg" alt="Entity-relationship diagram of the Unilever Product Management database showing 11 tables and their foreign key relationships" style="max-width:100%;height:auto" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'" /><div style="display:none;color:#ff7b72;padding:20px;text-align:center">ER diagram image not available. Run <code>npm run build:er</code> to generate it.</div></div>';
		return;
	}

	// Custom database — lazy-load mermaid on demand
	doRenderMermaid(container);
}

function doRenderMermaid(container: HTMLElement): void {
	if (typeof mermaid === "undefined" && !_mermaidLoading) {
		container.innerHTML =
			'<div style="color:#8b949e;padding:20px;text-align:center">⏳ Loading diagram renderer...</div>';

		_mermaidLoading = true;
		const script = document.createElement("script");
		script.src =
			"https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
		script.onload = () => {
			_mermaidLoading = false;
			mermaid.initialize({ theme: "dark", startOnLoad: false });
			renderMermaidFromSchema(container);
		};
		script.onerror = () => {
			_mermaidLoading = false;
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

	for (const [name, info] of Object.entries(schemaData)) {
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
	for (const [name, info] of Object.entries(schemaData)) {
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
	if (view === "er" && schemaData) {
		setTimeout(() => renderERDiagram(), 100);
	}
	if (view === "checks" && schemaData) {
		// checks may have missed init render; safe to re-call
		const container = document.getElementById("bv-checks");
		if (container && !container.innerHTML) renderChecks();
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
		if (schemaData) setTimeout(() => renderERDiagram(), 50);
	}
	if (cmEditor) setTimeout(() => cmEditor.refresh(), 50);
	if (cmSandbox) setTimeout(() => cmSandbox.refresh(), 50);
}

function loadSchema() {
	if (!schemaData) {
		schemaData = getSchema();
		renderTableCards();
		refreshEditorHints();
	}
}

// ─── Render Checks tab ─────────────────────────────────────────────────────
function renderChecks(): void {
	const container = document.getElementById("bv-checks");
	if (!container || !schemaData) return;
	let html = '<div class="table-cards">';
	for (const [name, info] of Object.entries(schemaData)) {
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

// ─── Bottom panel vertical resize ──────────────────────────────────────────
function addBottomResize(): void {
	const grip = document.getElementById("bottomGrip");
	const panel = document.getElementById("bottomPanel");
	if (!grip || !panel) return;
	let isDragging = false;
	let startY = 0;
	let startHeight = 0;

	grip.addEventListener("mousedown", (e: MouseEvent) => {
		if (panel.classList.contains("collapsed")) return;
		e.preventDefault();
		isDragging = true;
		startY = e.clientY;
		startHeight = panel.offsetHeight;
		document.body.style.cursor = "ns-resize";
		document.body.style.userSelect = "none";

		const onMove = (ev: MouseEvent) => {
			if (!isDragging) return;
			const delta = startY - ev.clientY;
			let h = startHeight + delta;
			const maxH = window.innerHeight * 0.5;
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
			clearTimeout(_bottomResizeTimer);
			_bottomResizeTimer = setTimeout(() => {
				if (schemaData) renderERDiagram();
			}, 300);
		};

		window.addEventListener("blur", onBlur);
		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	});
}

// ─── Practice Mode ─────────────────────────────────────────────────────────
function loadPractice(id: string): void {
	const ex = allExerciseDefs.find((e) => e.id === id);
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

	if (cmEditor) {
		cmEditor.toTextArea();
		cmEditor = null;
	}
	const last = sessionStorage.getItem("lastQuery_" + id) || "";
	cmEditor = createEditor("editorContainer", last);
	const actions = content.querySelector(".sql-actions");
	content
		.querySelector("#editorContainer")
		.insertBefore(
			content.querySelector("#editorContainer .CodeMirror"),
			actions,
		);

	cmEditor.setOption("extraKeys", {
		"Ctrl-Space": "autocomplete",
		"Ctrl-Enter": () => runJudge(),
		"Cmd-Enter": () => runJudge(),
	});

	if (schemaData) {
		cmEditor.setOption("hintOptions", {
			tables: buildTableHints(),
			completeSingle: false,
		});
	}

	cmEditor.focus();
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

	if (cmSandbox) {
		cmSandbox.toTextArea();
		cmSandbox = null;
	}
	cmSandbox = createEditor(
		"sandboxContainer",
		"SELECT * FROM HANG_HOA LIMIT 5;",
	);
	const actions = content.querySelector(".sql-actions");
	content
		.querySelector("#sandboxContainer")
		.insertBefore(
			content.querySelector("#sandboxContainer .CodeMirror"),
			actions,
		);

	cmSandbox.setOption("extraKeys", {
		"Ctrl-Space": "autocomplete",
		"Ctrl-Enter": () => runSandbox(),
		"Cmd-Enter": () => runSandbox(),
	});

	if (schemaData) {
		cmSandbox.setOption("hintOptions", {
			tables: buildTableHints(),
			completeSingle: false,
		});
	}

	cmSandbox.focus();
}

// ─── Build table hints from schema ─────────────────────────────────────────
function buildTableHints() {
	if (!schemaData) return {};
	const tables = {};
	for (const [name, info] of Object.entries(schemaData)) {
		tables[name] = info.columns.map((c) => c.name);
		tables[name.toLowerCase()] = info.columns.map((c) => c.name);
	}
	return tables;
}

// ─── Judge (client-side) ───────────────────────────────────────────────────
function runJudge() {
	const query = getEditorValue(cmEditor);
	if (!query) return;
	sessionStorage.setItem("lastQuery_" + currentId, query);

	const ex = allExerciseDefs.find((e) => e.id === currentId);
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
	const query = getEditorValue(cmSandbox);
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
	document.getElementById("dbName").textContent = activeDbName;
	document.getElementById("dbBadge").className =
		"db-badge" + (activeDbId === "custom" ? " custom" : "");
	document.getElementById("resetBtn").style.display =
		activeDbId === "custom" ? "" : "none";
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
			const newDb = new SQL.Database();
			newDb.run("PRAGMA foreign_keys = ON");
			newDb.run(sql);
			db = newDb;
			activeDbName = name;
			activeDbId = "custom";

			closeLoadSqlModal();
			schemaData = null;
			cmEditor = null;
			cmSandbox = null;
			currentId = null;
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
			schemaData = getSchema();
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
	db = new SQL.Database(new Uint8Array(buffer));
	activeDbName = "Unilever Product Management";
	activeDbId = "unilever";

	schemaData = null;
	cmEditor = null;
	cmSandbox = null;
	currentId = null;
	updateDbStatusUI();
	document.getElementById("mainTitle").textContent =
		"Unilever Product Management";
	document.getElementById("mainContent").innerHTML =
		'<div class="question" style="text-align:center;color:#8b949e;padding:60px 20px;"><h3>👈 Select an exercise from the sidebar</h3></div>';
	document
		.querySelectorAll(".exercise-item")
		.forEach((el) => el.classList.remove("active"));
	schemaData = getSchema();
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

async function init() {
	// Load version first so badge always displays
	try {
		const vRes = await fetch("VERSION");
		const vText = await vRes.text();
		document.getElementById("versionBadge").textContent = "v" + vText.trim();
	} catch {
		/* VERSION fetch is best-effort */
	}

	// Load exercises JSON
	try {
		const exRes = await fetch("exercises/exercises.json");
		allExerciseDefs = await exRes.json();
	} catch {
		/* exercises fetch is best-effort */
	}

	// Initialize sql.js (loads WASM from CDN)
	try {
		SQL = await initSqlJs({
			locateFile: (file) =>
				"https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/" + file,
		});
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
		db = new SQL.Database(new Uint8Array(dbBuffer));
	} catch (e) {
		document.getElementById("mainContent").innerHTML =
			'<div class="question" style="text-align:center;color:#ff7b72;padding:60px 20px;"><h3>❌ Failed to load database: ' +
			escHtml(e.message) +
			"</h3></div>";
		return;
	}

	updateDbStatusUI();
	schemaData = getSchema();
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
		bottomPanel.style.height = Math.round(window.innerHeight * 0.22) + "px";
	}
}

init().catch((e) => {
	console.error(e);
});
