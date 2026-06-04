#!/usr/bin/env node
/**
 * analyze_exercises.ts — Render a coverage matrix for exercise × table usage
 * and technique gap analysis.
 *
 * Usage:
 *   npx tsx scripts/analyze_exercises.ts
 */

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

const PUBLIC = new URL("../public", import.meta.url).pathname;
const DB_PATH = resolve(PUBLIC, "db", "Unilever_Product_Management.db");
const JSON_PATH = resolve(PUBLIC, "exercises", "exercises.json");

interface Exercise {
	id: string;
	title: string;
	difficulty: string;
	tables: string[];
	solution: string;
}

// ─── Table schema cache ────────────────────────────────────────────────────
let _tableSchema: Record<string, string[]> | null = null;

function getTableSchema(): Record<string, string[]> {
	if (_tableSchema) return _tableSchema;
	const db = new DatabaseSync(DB_PATH);
	const result: Record<string, string[]> = {};
	const tables = db
		.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
		.all() as { name: string }[];
	for (const t of tables) {
		const cols = db.prepare(`PRAGMA table_info('${t.name}')`).all() as {
			name: string;
		}[];
		result[t.name] = cols.map((c) => c.name);
	}
	db.close();
	_tableSchema = result;
	return result;
}

// ─── Technique detection ───────────────────────────────────────────────────
interface TechniqueInfo {
	count: number;
	exerciseIds: string[];
}

function detectTechniques(sol: string): string[] {
	const s = sol.toUpperCase();
	const tags: string[] = [];

	if (/SELECT\s+DISTINCT/.test(s)) tags.push("DISTINCT");
	if (/\bLEFT\s+JOIN\b/.test(s)) tags.push("LEFT JOIN");
	if (/\bJOIN\b/.test(s) && !/LEFT\s+JOIN/.test(s)) tags.push("INNER JOIN");
	if (
		/\bSELF\s*JOIN\b/i.test(sol) ||
		/FROM\s+\w+\s+(AS\s+)?[ab]\s+(INNER\s+)?JOIN\s+\w+\s+(AS\s+)?[ab]\b/i.test(
			s,
		)
	) {
		// Heuristic: same table on both sides of JOIN
		const m = sol.match(/FROM\s+(\w+)\s+(?:AS\s+)?(\w+)/i);
		if (m) {
			const alias = m[2];
			if (
				new RegExp(`JOIN\\s+${m[1]}\\s+(?:AS\\s+)?(?!${alias})\\w+`, "i").test(
					sol,
				)
			) {
				tags.push("SELF-JOIN");
			}
		}
	}
	if (/\bGROUP\s+BY\b/.test(s) && /\bHAVING\b/.test(s))
		tags.push("GROUP BY + HAVING");
	else if (/\bGROUP\s+BY\b/.test(s)) tags.push("GROUP BY");
	if (/\bLIMIT\b/.test(s)) tags.push("LIMIT");
	if (/\bUNION\b/.test(s)) tags.push("UNION/ALL");
	if (/\bINTERSECT\b/.test(s)) tags.push("INTERSECT");
	if (/\bEXCEPT\b/.test(s)) tags.push("EXCEPT");
	if (/\bCASE\b/.test(s)) tags.push("CASE");
	if (/\bLIKE\b/.test(s)) tags.push("LIKE");
	if (/\bSUBSTR\b/.test(s)) tags.push("SUBSTR");
	if (/\bCOALESCE\b/.test(s) || /\bIFNULL\b/.test(s)) tags.push("COALESCE");
	if (/\bIS\s+NULL\b/.test(s)) tags.push("IS NULL");
	if (/\bEXISTS\b/.test(s) && !/NOT\s+EXISTS/.test(s)) tags.push("EXISTS");
	if (/\bNOT\s+EXISTS\b/.test(s)) tags.push("NOT EXISTS");
	if (/\bIN\s*\(/.test(s) && /\bSELECT\b/.test(s)) tags.push("IN (subquery)");
	if (/\bNOT\s+IN\s*\(/.test(s) && /\bSELECT\b/.test(s))
		tags.push("NOT IN (subquery)");
	if (/FROM\s*\(/.test(s)) tags.push("Derived table (FROM)");
	if (/\(\s*SELECT\b/.test(s) && /\)\s*AS\b/.test(s))
		tags.push("Scalar subquery");
	if (/\bROW_NUMBER\b/.test(s) || /\bRANK\b/.test(s) || /\bOVER\s*\(/.test(s))
		tags.push("Window function");

	return [...new Set(tags)];
}

// ─── Table grouping for matrix columns ─────────────────────────────────────
const ALL_TABLES = [
	"HANG_HOA",
	"HOA_DON",
	"CTHD",
	"DAI_LY",
	"NHOM_HANG",
	"NHAN_VIEN",
	"PHIEU_XUAT",
	"CTPX",
	"DOI",
	"HINH_THUC_DONG_GOI",
	"LOAI_NV",
];

const SHORT = {
	HANG_HOA: "HH",
	HOA_DON: "HD",
	CTHD: "CTHD",
	DAI_LY: "DL",
	NHOM_HANG: "NH",
	NHAN_VIEN: "NV",
	PHIEU_XUAT: "PX",
	CTPX: "CTPX",
	DOI: "DOI",
	HINH_THUC_DONG_GOI: "HTDG",
	LOAI_NV: "LNV",
} as Record<string, string>;

// ─── Render helpers ────────────────────────────────────────────────────────
function boxTop(cols: number[]): string {
	return (
		"\u250c" + cols.map((w) => "\u2500".repeat(w + 2)).join("\u252c") + "\u2510"
	);
}
function boxSep(cols: number[]): string {
	return (
		"\u251c" + cols.map((w) => "\u2500".repeat(w + 2)).join("\u253c") + "\u2524"
	);
}
function boxBot(cols: number[]): string {
	return (
		"\u2514" + cols.map((w) => "\u2500".repeat(w + 2)).join("\u2534") + "\u2518"
	);
}
function boxRow(cols: { w: number; text: string }[]): string {
	return (
		"\u2502 " + cols.map((c) => c.text.padEnd(c.w)).join(" \u2502 ") + " \u2502"
	);
}

// ─── Main ──────────────────────────────────────────────────────────────────
function main(): void {
	const exercises: Exercise[] = JSON.parse(readFileSync(JSON_PATH, "utf-8"));
	const schema = getTableSchema();

	// ── Table─coverage matrix ──────────────────────────────────────────────
	const tableData: { id: string; diff: string; used: Set<string> }[] = [];
	const totals: Record<string, number> = {};
	for (const t of ALL_TABLES) totals[t] = 0;

	for (const ex of exercises) {
		const used = new Set<string>();
		for (const t of ex.tables) {
			if (ALL_TABLES.includes(t)) {
				used.add(t);
				totals[t]++;
			}
		}
		tableData.push({ id: ex.id, diff: ex.difficulty, used });
	}

	// Column widths
	const colW: number[] = [8]; // id col
	for (const t of ALL_TABLES) colW.push(4);

	// Header
	const header = [{ w: 8, text: "Exercise" }];
	for (const t of ALL_TABLES) header.push({ w: 4, text: SHORT[t] });

	console.log("\n  " + boxTop(colW));
	console.log("  " + boxRow(header));
	console.log("  " + boxSep(colW));

	for (const row of tableData) {
		const cells = [{ w: 8, text: row.id }];
		for (const t of ALL_TABLES) {
			cells.push({
				w: 4,
				text: row.used.has(t) ? "\u2713" : "",
			});
		}
		console.log("  " + boxRow(cells));
	}

	console.log("  " + boxSep(colW));

	const totalRow = [{ w: 8, text: "Total" }];
	for (const t of ALL_TABLES) totalRow.push({ w: 4, text: String(totals[t]) });
	console.log("  " + boxRow(totalRow));
	console.log("  " + boxBot(colW));

	// ── Difficulty distribution ────────────────────────────────────────────
	const diffCounts: Record<string, number> = {};
	for (const ex of exercises) {
		diffCounts[ex.difficulty] = (diffCounts[ex.difficulty] || 0) + 1;
	}
	const barW = 40;
	console.log("\n  Difficulty distribution:");
	for (const d of ["Easy", "Medium", "Hard"]) {
		const n = diffCounts[d] || 0;
		const bar = "\u2588".repeat(Math.round((n / exercises.length) * barW));
		console.log(`    ${d.padEnd(8)} ${n.toString().padStart(2)}  ${bar}`);
	}
	console.log(`    ${"─".repeat(8)} ${"─".repeat(3)}  ${"─".repeat(barW)}`);
	console.log(`    ${"Total".padEnd(8)} ${exercises.length}`);

	// ── Technique gap analysis ─────────────────────────────────────────────
	const techMap: Record<string, TechniqueInfo> = {};
	for (const ex of exercises) {
		const tags = detectTechniques(ex.solution);
		for (const tag of tags) {
			if (!techMap[tag]) techMap[tag] = { count: 0, exerciseIds: [] };
			techMap[tag].count++;
			techMap[tag].exerciseIds.push(ex.id);
		}
	}

	console.log("\n  Technique coverage:");
	const TECH_INTEREST = [
		"UNION/ALL",
		"INTERSECT",
		"EXCEPT",
		"CASE",
		"LIKE",
		"SUBSTR",
		"LEFT JOIN",
		"SELF-JOIN",
		"GROUP BY",
		"GROUP BY + HAVING",
		"LIMIT",
		"DISTINCT",
		"IS NULL",
		"EXISTS",
		"NOT EXISTS",
		"IN (subquery)",
		"NOT IN (subquery)",
		"Derived table (FROM)",
		"Scalar subquery",
		"COALESCE",
		"Window function",
	];
	for (const tech of TECH_INTEREST) {
		const info = techMap[tech];
		if (info) {
			console.log(
				`    \u2713 ${tech.padEnd(22)} ${info.count} ex  ${info.exerciseIds.join(", ")}`,
			);
		} else {
			console.log(`    \u2717 ${tech.padEnd(22)} 0 ex  \u2190 GAP`);
		}
	}

	// ── Table summary ──────────────────────────────────────────────────────
	console.log("\n  Table coverage:");
	const tableCounts = exercises.reduce(
		(acc, ex) => {
			for (const t of ex.tables) {
				if (ALL_TABLES.includes(t)) acc[t] = (acc[t] || 0) + 1;
			}
			return acc;
		},
		{} as Record<string, number>,
	);
	for (const t of ALL_TABLES) {
		const n = tableCounts[t] || 0;
		const bar = "\u2588".repeat(Math.round((n / exercises.length) * barW));
		console.log(
			`    ${SHORT[t].padEnd(5)} ${t.padEnd(18)} ${n.toString().padStart(2)}  ${bar}`,
		);
	}
}

main();
