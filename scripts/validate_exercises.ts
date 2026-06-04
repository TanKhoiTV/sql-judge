#!/usr/bin/env node
/**
 * validate_exercises.ts — Run every exercise solution against the actual SQLite
 * database and report PASS/FAIL. Exits non-zero on any failure.
 *
 * Usage:
 *   npx tsx scripts/validate_exercises.ts
 *   npx tsx scripts/validate_exercises.ts --db path/to/db --json path/to/json
 */

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PUBLIC = new URL("../public", import.meta.url).pathname;

// Parse optional CLI flags
const args = process.argv.slice(2);
const dbPath =
	args[args.indexOf("--db") + 1] ||
	resolve(PUBLIC, "db", "Unilever_Product_Management.db");
const jsonPath =
	args[args.indexOf("--json") + 1] ||
	resolve(PUBLIC, "exercises", "exercises.json");

interface Exercise {
	id: string;
	title: string;
	difficulty: string;
	solution: string;
}

function main(): void {
	const exercises: Exercise[] = JSON.parse(readFileSync(jsonPath, "utf-8"));
	const db = new DatabaseSync(dbPath);

	let passed = 0;
	let failed = 0;
	let warned = 0;
	const failures: string[] = [];

	console.log(`\n  VALIDATING ${exercises.length} EXERCISES\n`);
	console.log("  " + "\u2501".repeat(60));

	for (const ex of exercises) {
		const label = `  ${ex.id.padEnd(35)}`;
		try {
			const stmt = db.prepare(ex.solution);
			const cols = stmt.columns();
			const rows = stmt.all();
			const colNames = cols.map((c) => c.name).join(", ");
			const rowCount = rows.length;

			// Summarise first row for a quick sanity check
			let sample = "";
			if (rows.length > 0) {
				const first = rows[0] as Record<string, unknown>;
				const vals = Object.values(first)
					.slice(0, 3)
					.map((v) => String(v ?? "NULL"));
				sample = `  e.g. ${vals.join(", ")}`;
			}

			if (rowCount === 0 && ex.difficulty !== "Easy") {
				console.log(
					`${label} PASS (${cols.length} cols, 0 rows)\u001b[33m \u26a0 zero rows\u001b[0m`,
				);
				warned++;
			} else {
				console.log(
					`${label} PASS (${cols.length} cols \u00d7 ${rowCount} rows)${sample ? `  ${sample}` : ""}`,
				);
			}
			passed++;
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			console.log(`${label}\u001b[31m FAIL \u2014 ${msg}\u001b[0m`);
			failed++;
			failures.push(`  ${ex.id}: ${msg}`);
		}
	}

	db.close();

	console.log("");
	console.log("  " + "\u2501".repeat(60));
	console.log(`  RESULTS: ${passed} PASS, ${failed} FAIL, ${warned} WARN\n`);

	if (failures.length > 0) {
		console.log("  Failures:");
		for (const f of failures) console.log(f);
		console.log("");
	}

	process.exit(failed > 0 ? 1 : 0);
}

main();
