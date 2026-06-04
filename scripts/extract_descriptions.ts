// Extract descriptions from SQL script using the /*block-comment*/ convention.
//
// Convention:
//   - A /* ... */ block immediately before CREATE TABLE → table description
//   - An inline /* ... */ after a column definition → column description
//
// Output: JSON with table → { description, columns: { col → string } }

import { readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_DIR = path.resolve(__dirname);

function main() {
	const sqlPath = path.join(
		SCRIPT_DIR,
		"Unilever_Product_Management.sqlite.sql",
	);
	const sql = readFileSync(sqlPath, "utf8");
	const lines = sql.split("\n");

	const result: Record<
		string,
		{ description: string; columns: Record<string, string> }
	> = {};
	let currentTable: string | null = null;
	let pendingComment: string | null = null;
	let inBlockComment = false;
	let blockBuf: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		const trimmed = raw.trim();

		// Track multi-line /* ... */ blocks
		if (!inBlockComment && trimmed.startsWith("/*")) {
			// Strip the leading /* and optional * from first line
			const firstLine = trimmed
				.slice(2)
				.replace(/\*\/.*/, "")
				.replace(/^\s*\*\s?/, "")
				.trim();
			blockBuf = [firstLine];
			if (trimmed.includes("*/")) {
				// single-line block comment
				pendingComment = blockBuf[0];
				blockBuf = [];
			} else {
				inBlockComment = true;
			}
			continue;
		}

		if (inBlockComment) {
			const endIdx = trimmed.indexOf("*/");
			if (endIdx >= 0) {
				const line = trimmed
					.slice(0, endIdx)
					.replace(/^\s*\*\s?/, "")
					.trim();
				blockBuf.push(line);
				inBlockComment = false;
				const text = blockBuf.join(" ").replace(/\s+/g, " ").trim();
				pendingComment = text;
				blockBuf = [];
			} else {
				blockBuf.push(trimmed.replace(/^\s*\*\s?/, "").trim());
			}
			continue;
		}

		// Check for CREATE TABLE
		const ctMatch = trimmed.match(
			/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i,
		);
		if (ctMatch) {
			currentTable = ctMatch[1];
			if (pendingComment) {
				result[currentTable] = {
					description: pendingComment,
					columns: {},
				};
			}
			pendingComment = null;

			// Parse column definitions inside this CREATE TABLE
			let j = i + 1;
			let depth = 1;
			while (j < lines.length && depth > 0) {
				const colLine = lines[j].trim();
				if (colLine.includes("(")) depth++;
				if (colLine.includes(")")) depth--;

				// Extract column name and inline comment
				// Column pattern: NAME TYPE [CONSTRAINTS] /* comment */
				if (
					depth >= 1 &&
					!colLine.startsWith("FOREIGN") &&
					!colLine.startsWith("PRIMARY")
				) {
					const colMatch = colLine.match(/^\s*(\w+)\s+.*?\/\*\s*(.+?)\s*\*\//);
					if (colMatch && currentTable && result[currentTable]) {
						result[currentTable].columns[colMatch[1]] = colMatch[2]
							.replace(/^\s*\*\s?/, "")
							.trim();
					}
				}
				j++;
			}
			continue;
		}

		// Non-matching lines clear pending comment
		if (trimmed !== "" && !trimmed.startsWith("--")) {
			pendingComment = null;
		}
	}

	const outPath = path.join(
		SCRIPT_DIR,
		"..",
		"public",
		"db",
		"Unilever_Product_Management.descriptions.json",
	);
	writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
	console.log(
		`Extracted ${Object.keys(result).length} table descriptions → ${outPath}`,
	);
}

main();
