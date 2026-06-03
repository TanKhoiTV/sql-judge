const express = require("express");
const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const DEFAULT_DB_PATH = path.join(__dirname, "Unilever_Product_Management.db");
const CUSTOM_DB_PATH = path.join(__dirname, "custom.db");
const EXERCISES_PATH = path.join(__dirname, "exercises", "exercises.json");
const exercises = JSON.parse(fs.readFileSync(EXERCISES_PATH, "utf8"));

// ─── Active database state ────────────────────────────────────────────────
let activeDbPath = DEFAULT_DB_PATH;
let activeDbName = "Unilever Product Management";
let activeDbId = "unilever";

function resetToDefault() {
	activeDbPath = DEFAULT_DB_PATH;
	activeDbName = "Unilever Product Management";
	activeDbId = "unilever";
	try {
		fs.unlinkSync(CUSTOM_DB_PATH);
	} catch {}
}

function getDbStatus() {
	return {
		name: activeDbName,
		dbId: activeDbId,
		hasExercises: activeDbId === "unilever",
	};
}

// ─── Utilities ────────────────────────────────────────────────────────────
function runQuery(sql) {
	const db = new DatabaseSync(activeDbPath);
	db.exec("PRAGMA foreign_keys = ON");
	try {
		const stmt = db.prepare(sql);
		const cols = stmt.columns().map((c) => c.name);
		const rows = stmt.all();
		return { ok: true, cols, rows, rowCount: rows.length };
	} catch (err) {
		return { ok: false, error: err.message };
	} finally {
		db.close();
	}
}

function getSchema() {
	const db = new DatabaseSync(activeDbPath);
	db.exec("PRAGMA foreign_keys = ON");
	const tables = {};
	const tableNames = db
		.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
		.all()
		.map((r) => r.name);
	for (const t of tableNames) {
		const cols = db
			.prepare(`PRAGMA table_info('${t}')`)
			.all()
			.map((c) => ({
				name: c.name,
				type: c.type,
				pk: !!c.pk,
				notnull: !!c.notnull,
				default: c.dflt_value,
			}));
		const fks = db
			.prepare(`PRAGMA foreign_key_list('${t}')`)
			.all()
			.map((fk) => ({
				from: fk.from,
				table: fk.table,
				to: fk.to,
			}));
		tables[t] = { columns: cols, foreignKeys: fks };
	}
	db.close();
	return tables;
}

function normalizeValue(v) {
	if (v === null || v === undefined) return "";
	if (typeof v === "number") return String(Math.round(v * 1e9) / 1e9);
	return String(v).trim();
}

function compareResults(user, ref) {
	const issues = [];
	if (!user.ok) {
		return { pass: false, issues: [`Query failed: ${user.error}`] };
	}
	if (user.cols.length !== ref.cols.length) {
		issues.push(
			`Expected ${ref.cols.length} column(s) [${ref.cols.join(", ")}], got ${user.cols.length} [${user.cols.join(", ")}]`,
		);
	}
	const userColsLower = user.cols.map((c) => c.toLowerCase());
	const refColsLower = ref.cols.map((c) => c.toLowerCase());
	for (let i = 0; i < Math.min(user.cols.length, ref.cols.length); i++) {
		if (userColsLower[i] !== refColsLower[i]) {
			issues.push(
				`Column ${i + 1}: expected "${ref.cols[i]}", got "${user.cols[i]}"`,
			);
		}
	}
	if (user.rowCount !== ref.rowCount) {
		issues.push(`Expected ${ref.rowCount} row(s), got ${user.rowCount}`);
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
			`${missing.length} missing row(s), ${extra.length} extra row(s)`,
		);
	}
	return { pass: issues.length === 0, issues };
}

// ─── API: Database management ──────────────────────────────────────────────

app.get("/api/db-status", (_req, res) => {
	res.json(getDbStatus());
});

app.post("/api/load-sql", (req, res) => {
	const { sql, name } = req.body;
	if (!sql || !sql.trim()) {
		return res.status(400).json({ error: "No SQL provided" });
	}

	try {
		fs.unlinkSync(CUSTOM_DB_PATH);
	} catch {}

	// Execute the SQL script against a fresh database
	const db = new DatabaseSync(CUSTOM_DB_PATH);
	db.exec("PRAGMA foreign_keys = ON");
	try {
		db.exec(sql);
	} catch (err) {
		db.close();
		try {
			fs.unlinkSync(CUSTOM_DB_PATH);
		} catch {}
		return res.status(400).json({ error: `SQL error: ${err.message}` });
	}
	db.close();

	activeDbPath = CUSTOM_DB_PATH;
	activeDbName = (name || "").trim() || path.basename(CUSTOM_DB_PATH);
	activeDbId = "custom";

	res.json(getDbStatus());
});

app.post("/api/reset", (_req, res) => {
	resetToDefault();
	res.json(getDbStatus());
});

// ─── API: Exercises ───────────────────────────────────────────────────────

app.get("/api/exercises", (_req, res) => {
	if (activeDbId !== "unilever") return res.json([]);
	res.json(
		exercises.map((e) => ({
			id: e.id,
			title: e.title,
			difficulty: e.difficulty,
		})),
	);
});

app.get("/api/exercises/:id", (req, res) => {
	if (activeDbId !== "unilever") {
		return res.status(404).json({ error: "No exercises for this database" });
	}
	const ex = exercises.find((e) => e.id === req.params.id);
	if (!ex) return res.status(404).json({ error: "Exercise not found" });
	res.json({
		id: ex.id,
		title: ex.title,
		difficulty: ex.difficulty,
		question: ex.question,
		tables: ex.tables,
	});
});

app.post("/api/judge/:id", (req, res) => {
	if (activeDbId !== "unilever") {
		return res
			.status(400)
			.json({ error: "Judging not available for this database" });
	}
	const ex = exercises.find((e) => e.id === req.params.id);
	if (!ex) return res.status(404).json({ error: "Exercise not found" });
	const query = (req.body.query || "").trim();
	if (!query) return res.status(400).json({ error: "Query is empty" });

	const user = runQuery(query);
	const ref = runQuery(ex.solution);
	const result = compareResults(user, ref);

	res.json({
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
			? { cols: ref.cols, rows: ref.rows.slice(0, 50), rowCount: ref.rowCount }
			: null,
		solution: ex.solution,
		hint: ex.hint || null,
	});
});

// ─── API: Schema & Query ──────────────────────────────────────────────────

app.get("/api/schema", (_req, res) => {
	res.json(getSchema());
});

app.post("/api/query", (req, res) => {
	const query = (req.body.query || "").trim();
	if (!query) return res.status(400).json({ error: "Query is empty" });
	const result = runQuery(query);
	res.json(
		result.ok
			? {
					ok: true,
					cols: result.cols,
					rows: result.rows.slice(0, 100),
					rowCount: result.rowCount,
				}
			: { ok: false, error: result.error },
	);
});

// ─── Start ────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`SQL Judge UI → http://localhost:${PORT}`);
});
