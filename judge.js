#!/usr/bin/env node
/**
 * SQL Query Judge - Practice SQL by comparing your queries against reference solutions.
 *
 * Usage:
 *   node judge.js list                 — List all exercises
 *   node judge.js show <id>            — Show the question for an exercise
 *   node judge.js solve <id> "SELECT..." — Submit a query inline
 *   node judge.js solve <id> -f query.sql — Submit a query from file
 *   node judge.js random               — Pick a random exercise
 *   node judge.js solve <id>           — Interactive mode (prompts for query)
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");
const readline = require("readline");

const DB_PATH = path.join(__dirname, "public", "db", "Unilever_Product_Management.db");
const EXERCISES_PATH = path.join(__dirname, "public", "exercises", "exercises.json");

const exercises = JSON.parse(fs.readFileSync(EXERCISES_PATH, "utf8"));

// ─── Database helpers ─────────────────────────────────────────────────────

function runQuery(sql) {
	const db = new DatabaseSync(DB_PATH);
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

// ─── Result comparison ────────────────────────────────────────────────────

function normalizeValue(v) {
	if (v === null || v === undefined) return "";
	// Normalize numbers: 4500 vs 4500.0 are the same
	if (typeof v === "number") return String(Math.round(v * 1e9) / 1e9);
	return String(v).trim();
}

function compareResults(user, ref) {
	const issues = [];

	// Check execution
	if (!user.ok) {
		return { pass: false, issues: [`[ERROR] Query failed: ${user.error}`] };
	}

	// Compare column count
	if (user.cols.length !== ref.cols.length) {
		issues.push(
			`[COLUMNS] Expected ${ref.cols.length} column(s) [${ref.cols.join(", ")}], ` +
				`but got ${user.cols.length} [${user.cols.join(", ")}]`,
		);
	}

	// Compare column names (case-insensitive)
	const userColsLower = user.cols.map((c) => c.toLowerCase());
	const refColsLower = ref.cols.map((c) => c.toLowerCase());
	for (let i = 0; i < Math.min(user.cols.length, ref.cols.length); i++) {
		if (userColsLower[i] !== refColsLower[i]) {
			issues.push(
				`[COLUMN ${i + 1}] Expected "${ref.cols[i]}" but got "${user.cols[i]}"`,
			);
		}
	}

	// Compare row count
	if (user.rowCount !== ref.rowCount) {
		issues.push(
			`[ROWS] Expected ${ref.rowCount} row(s), but got ${user.rowCount}`,
		);
	}

	// Compare data: sort both result sets for order-independent comparison
	const matchCount = Math.min(user.rowCount, ref.rowCount);
	const userColCount = Math.min(user.cols.length, ref.cols.length);

	// Create normalized string sets for full comparison
	const userSet = new Set();
	for (const row of user.rows) {
		const key = user.cols
			.slice(0, userColCount)
			.map((c) => normalizeValue(row[c]))
			.join("||");
		userSet.add(key);
	}
	const refSet = new Set();
	for (const row of ref.rows) {
		const key = ref.cols
			.slice(0, userColCount)
			.map((c) => normalizeValue(row[c]))
			.join("||");
		refSet.add(key);
	}

	// Find rows in ref but not in user
	const missing = [...refSet].filter((k) => !userSet.has(k));
	// Find rows in user but not in ref
	const extra = [...userSet].filter((k) => !refSet.has(k));

	if (missing.length > 0 || extra.length > 0) {
		issues.push(
			`[DATA] ${missing.length} missing row(s), ${extra.length} extra row(s) (comparing first ${userColCount} columns)`,
		);
		if (missing.length <= 3) {
			for (const row of missing) {
				issues.push(`  MISSING: [${row}]`);
			}
		}
		if (extra.length <= 3) {
			for (const row of extra) {
				issues.push(`  EXTRA:   [${row}]`);
			}
		}
	}

	return { pass: issues.length === 0, issues };
}

// ─── Display helpers ─────────────────────────────────────────────────────

function pad(s, n) {
	return String(s).padEnd(n);
}

function printTable(cols, rows, maxRows = 15) {
	// Calculate column widths
	const widths = cols.map((c, i) => {
		const dataMax = Math.max(
			...rows.slice(0, maxRows).map((r) => String(r[c] ?? "").length),
		);
		return Math.max(c.length, dataMax, 5);
	});

	// Header
	const header = cols.map((c, i) => pad(c, widths[i])).join(" | ");
	console.log(header);
	console.log("-".repeat(header.length));

	// Rows
	const display = rows.slice(0, maxRows);
	for (const row of display) {
		console.log(
			cols.map((c, i) => pad(row[c] ?? "NULL", widths[i])).join(" | "),
		);
	}
	if (rows.length > maxRows) {
		console.log(`... and ${rows.length - maxRows} more row(s)`);
	}
	console.log(`(${rows.length} row(s))`);
}

// ─── Commands ────────────────────────────────────────────────────────────

function cmdList() {
	console.log("\n  Available SQL Exercises:\n");
	console.log(`  ${"ID".padEnd(22)} ${"Title".padEnd(42)} Difficulty`);
	console.log(
		`  ${"".padEnd(22, "-")} ${"".padEnd(42, "-")} ${"".padEnd(10, "-")}`,
	);
	for (const ex of exercises) {
		console.log(
			`  ${ex.id.padEnd(22)} ${ex.title.padEnd(42)} ${ex.difficulty}`,
		);
	}
	console.log(`\n  Usage: node judge.js show <id>`);
	console.log(`  Usage: node judge.js solve <id> "YOUR SQL"`);
}

function cmdShow(id) {
	const ex = exercises.find((e) => e.id === id);
	if (!ex) {
		console.log(`Exercise "${id}" not found.`);
		console.log(`Available: ${exercises.map((e) => e.id).join(", ")}`);
		return;
	}
	console.log(`\n  ${ex.id} — ${ex.title} (${ex.difficulty})\n`);
	console.log(`  ${ex.question}\n`);
	if (ex.tables) {
		console.log(`  Tables: ${ex.tables.join(", ")}`);
	}
	console.log("");
}

function cmdSolve(id, userQuery) {
	const ex = exercises.find((e) => e.id === id);
	if (!ex) {
		console.log(`Exercise "${id}" not found.`);
		return;
	}

	if (!userQuery) {
		// Interactive mode
		cmdShow(id);
		console.log(
			"  Enter your SQL query below (end with Ctrl+D or empty line + Ctrl+D):\n",
		);
		const rl = readline.createInterface({ input: process.stdin });
		const lines = [];
		rl.on("line", (l) => lines.push(l));
		rl.on("close", () => {
			userQuery = lines.join("\n").trim();
			if (userQuery) judge(id, ex, userQuery);
		});
		return;
	}

	judge(id, ex, userQuery);
}

function judge(id, ex, userQuery) {
	console.log(`\n  ╔══════════════════════════════════════════════╗`);
	console.log(`  ║  Exercise: ${ex.id.padEnd(37)}║`);
	console.log(`  ║  ${ex.title.padEnd(46)}║`);
	console.log(`  ╚══════════════════════════════════════════════╝\n`);

	// Run user query
	console.log("  📝 Your query:");
	console.log(`  ${userQuery.replace(/\n/g, "\n  ")}\n`);

	const user = runQuery(userQuery);
	if (!user.ok) {
		console.log(`  ❌ Query error: ${user.error}\n`);
		return;
	}

	console.log(`  ✅ Query executed: ${user.rowCount} row(s) returned\n`);
	if (user.rowCount > 0 && user.rowCount <= 10) {
		printTable(user.cols, user.rows, 10);
		console.log("");
	}

	// Run reference solution
	const ref = runQuery(ex.solution);

	// Compare
	console.log("  🔍 Judging...\n");
	const { pass, issues } = compareResults(user, ref);

	if (pass) {
		console.log(`  ✅ ✅ ✅  PASS!  ✅ ✅ ✅\n`);
		console.log(`  Your query matches the reference solution.\n`);

		// Show reference for learning
		console.log(`  Reference solution:`);
		console.log(`  ${ex.solution.replace(/\n/g, "\n  ")}\n`);

		// Show reference results
		if (ref.rowCount > 0 && ref.rowCount <= 10) {
			console.log(`  Expected output:`);
			printTable(ref.cols, ref.rows, 10);
		}
	} else {
		console.log(`  ❌ ❌ ❌  FAILED  ❌ ❌ ❌\n`);
		for (const issue of issues) {
			console.log(`  • ${issue}`);
		}
		console.log("");

		if (ex.hint) {
			console.log(`  💡 Hint: ${ex.hint}\n`);
		}

		console.log(`  Reference solution:`);
		console.log(`  ${ex.solution.replace(/\n/g, "\n  ")}\n`);

		if (ref.rowCount > 0 && ref.rowCount <= 10) {
			console.log(`  Expected output:`);
			printTable(ref.cols, ref.rows, 10);
			console.log("");
		}

		console.log(`  Your output:`);
		if (user.rowCount > 0 && user.rowCount <= 10) {
			printTable(user.cols, user.rows, 10);
		}
		console.log("");
	}
}

function cmdRandom() {
	const ex = exercises[Math.floor(Math.random() * exercises.length)];
	cmdShow(ex.id);
}

// ─── Main CLI ─────────────────────────────────────────────────────────────

function main() {
	const args = process.argv.slice(2);
	const cmd = args[0] || "list";

	switch (cmd) {
		case "list":
			cmdList();
			break;
		case "show":
			cmdShow(args[1]);
			break;
		case "solve": {
			// Check for file input: -f <filepath>
			if (args[2] === "-f" && args[3]) {
				const queryPath = path.resolve(args[3]);
				if (!fs.existsSync(queryPath)) {
					console.log(`File not found: ${queryPath}`);
					process.exit(1);
				}
				const query = fs.readFileSync(queryPath, "utf8").trim();
				cmdSolve(args[1], query);
			} else {
				const query = args.slice(2).join(" ");
				cmdSolve(args[1], query || null);
			}
			break;
		}
		case "random":
			cmdRandom();
			break;
		default:
			console.log(`Unknown command: ${cmd}`);
			console.log(`Usage: node judge.js [list|show|solve|random]`);
	}
}

main();
