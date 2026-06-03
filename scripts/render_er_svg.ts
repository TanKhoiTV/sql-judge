/**
 * render_er_svg.ts — Pre-renders the ER diagram as a static SVG for the preset
 * Unilever database. Called during `npm run build`. Eliminates the 3.2MB
 * mermaid.js dependency from the critical path for the preset database.
 *
 * Uses node:sqlite (built into Node.js 24+) — zero external dependencies.
 */

import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../public/db/Unilever_Product_Management.db");
const OUT_PATH = path.resolve(__dirname, "../public/db/Unilever_Product_Management.er.svg");

// ─── Layout constants ──────────────────────────────────────────────────────
const TABLE_W = 200;
const COL_H = 22;
const HDR_H = 30;
const LAYER_GAP = 260;
const TABLE_GAP = 24;
const PAD = 40;
const TOP = 60;
const COL_INNER_PAD = 10;
const R = 6; // corner radius

// ─── Color scheme (VS Code dark theme) ─────────────────────────────────────
const C = {
	bg: "#0d1117",
	tableBg: "#161b22",
	headerBg: "#1c2128",
	headerText: "#e6edf3",
	colText: "#c9d1d9",
	colAlt: "#1c2128",
	colBorder: "#30363d",
	pkText: "#58a6ff",
	fkText: "#8b949e",
	fkLine: "#484f58",
	fkLineHl: "#58a6ff",
	typeText: "#8b949e",
};

// ─── Schema types ──────────────────────────────────────────────────────────
interface Column {
	name: string;
	type: string;
	pk: boolean;
	notnull: boolean;
	default: string | null;
}

interface ForeignKey {
	from: string;
	table: string;
	to: string;
}

interface TableInfo {
	columns: Column[];
	foreignKeys: ForeignKey[];
}

interface Position {
	x: number;
	y: number;
	tableHeight: number;
}

// ─── Read schema from SQLite ───────────────────────────────────────────────
function getSchema(dbPath: string): Map<string, TableInfo> {
	const db = new DatabaseSync(dbPath);
	const tables = new Map<string, TableInfo>();

	const tableRows = db
		.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
		.all() as { name: string }[];

	for (const { name } of tableRows) {
		const colRows = db
			.prepare(`PRAGMA table_info('${name}')`)
			.all() as any[];
		const columns: Column[] = colRows.map((r: any) => ({
			name: r.name,
			type: r.type,
			pk: !!r.pk,
			notnull: !!r.notnull,
			default: r.dflt_value,
		}));

		const fkRows = db
			.prepare(`PRAGMA foreign_key_list('${name}')`)
			.all() as any[];
		const foreignKeys: ForeignKey[] = fkRows.map((r: any) => ({
			from: r.from,
			table: r.table,
			to: r.to,
		}));

		tables.set(name, { columns, foreignKeys });
	}

	db.close();
	return tables;
}

// ─── Topological layer assignment ──────────────────────────────────────────
function assignLayers(
	tables: Map<string, TableInfo>,
): Map<string, number> {
	const layers = new Map<string, number>();
	const tableNames = [...tables.keys()];

	// Build reverse lookup: table → set of tables it depends on
	const dependsOn = new Map<string, Set<string>>();
	for (const [name, info] of tables) {
		const deps = new Set<string>();
		for (const fk of info.foreignKeys) {
			if (tables.has(fk.table)) deps.add(fk.table);
		}
		dependsOn.set(name, deps);
	}

	const maxIter = tableNames.length * 3;
	let iter = 0;
	let changed = true;
	while (changed) {
		iter++;
		if (iter > maxIter) {
			throw new Error(
				"Circular FK dependency detected — topology sort failed to converge.",
			);
		}
		changed = false;
		for (const name of tableNames) {
			const deps = dependsOn.get(name)!;
			if (deps.size === 0) {
				if (!layers.has(name) || layers.get(name) !== 0) {
					layers.set(name, 0);
					changed = true;
				}
				continue;
			}
			let maxDepLayer = -1;
			let allAssigned = true;
			for (const dep of deps) {
				if (!layers.has(dep)) {
					allAssigned = false;
					break;
				}
				maxDepLayer = Math.max(maxDepLayer, layers.get(dep)!);
			}
			if (allAssigned) {
				const l = maxDepLayer + 1;
				if (!layers.has(name) || layers.get(name) !== l) {
					layers.set(name, l);
					changed = true;
				}
			}
		}
	}

	return layers;
}

// ─── Compute positions ─────────────────────────────────────────────────────
function computePositions(
	tables: Map<string, TableInfo>,
	layers: Map<string, number>,
): Map<string, Position> {
	const positions = new Map<string, Position>();

	// Group tables by layer
	const layerMap = new Map<number, string[]>();
	for (const [name] of tables) {
		const l = layers.get(name) ?? 0;
		if (!layerMap.has(l)) layerMap.set(l, []);
		layerMap.get(l)!.push(name);
	}

	const maxLayer = Math.max(...layerMap.keys());

	for (let l = 0; l <= maxLayer; l++) {
		const names = layerMap.get(l) ?? [];
		const x = PAD + l * LAYER_GAP;
		let y = TOP;

		for (const name of names) {
			const info = tables.get(name)!;
			const tableH = HDR_H + info.columns.length * COL_H;
			positions.set(name, { x, y, tableHeight: tableH });
			y += tableH + TABLE_GAP;
		}
	}

	return positions;
}

// ─── SVG building helpers ───────────────────────────────────────────────────

function svgAttr(name: string, val: string | number): string {
	return ` ${name}="${val}"`;
}

function svgRect(
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
	fill: string,
	stroke: string,
): string {
	return `<rect${svgAttr("x", x)}${svgAttr("y", y)}${svgAttr("width", w)}${svgAttr("height", h)}${svgAttr("rx", r)}${svgAttr("fill", fill)}${svgAttr("stroke", stroke)}${svgAttr("stroke-width", "1")}/>`;
}

function svgText(
	x: number,
	y: number,
	text: string,
	fill: string,
	fontSize: number,
	weight?: string,
	family?: string,
): string {
	const attrs = `x="${x}" y="${y}" fill="${fill}" font-size="${fontSize}"${weight ? ` font-weight="${weight}"` : ""}${family ? ` font-family="${family}"` : ""}`;
	return `<text ${attrs}>${escXml(text)}</text>`;
}

function escXml(s: string): string {
	return String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function drawCard(
	name: string,
	info: TableInfo,
	pos: Position,
): string {
	const { x, y, tableHeight } = pos;
	const lines: string[] = [];

	// Table background
	lines.push(svgRect(x, y, TABLE_W, tableHeight, R, C.tableBg, C.colBorder));

	// Header bar
	lines.push(svgRect(x, y + HDR_H - R, TABLE_W, R, 0, C.headerBg, C.headerBg));
	lines.push(
		svgRect(x, y, TABLE_W, HDR_H, R, C.headerBg, C.colBorder),
	);
	// Header bottom line (overlap with main rect)
	lines.push(
		`<line${svgAttr("x1", x)}${svgAttr("y1", y + HDR_H)}${svgAttr("x2", x + TABLE_W)}${svgAttr("y2", y + HDR_H)}${svgAttr("stroke", C.colBorder)}${svgAttr("stroke-width", "1")}/>`,
	);

	// Header text
	lines.push(
		svgText(
			x + COL_INNER_PAD,
			y + HDR_H / 2 + 4,
			name,
			C.headerText,
			13,
			"600",
			"monospace",
		),
	);

	// Column rows
	const fkColNames = new Set(info.foreignKeys.map((fk) => fk.from));

	for (let i = 0; i < info.columns.length; i++) {
		const c = info.columns[i];
		const cy = y + HDR_H + i * COL_H;
		const bg = i % 2 === 0 ? C.tableBg : C.colAlt;

		lines.push(svgRect(x, cy, TABLE_W, COL_H, 0, bg, "none"));

		// Column name
		let nameColor = C.colText;
		let prefix = "";
		if (c.pk) {
			nameColor = C.pkText;
			prefix = "🔑 ";
		} else if (fkColNames.has(c.name)) {
			nameColor = C.fkText;
			prefix = "↳ ";
		}
		const nameDisplay = prefix + c.name;
		lines.push(
			svgText(
				x + COL_INNER_PAD,
				cy + COL_H / 2 + 4,
				nameDisplay,
				nameColor,
				11,
				c.pk ? "600" : "400",
				"monospace",
			),
		);

		// Column type (right-aligned)
		const typeDisplay = c.type.replace(/\(.*\)/, "").toLowerCase();
		lines.push(
			`<text x="${x + TABLE_W - COL_INNER_PAD}" y="${cy + COL_H / 2 + 4}" fill="${C.typeText}" font-size="9" font-weight="400" font-family="monospace" text-anchor="end">${escXml(typeDisplay)}</text>`,
		);
	}

	return lines.join("\n");
}

function drawFK(
	tables: Map<string, TableInfo>,
	positions: Map<string, Position>,
): string {
	const lines: string[] = [];

	for (const [name, info] of tables) {
		for (const fk of info.foreignKeys) {
			const fromPos = positions.get(name);
			const toPos = positions.get(fk.table);
			if (!fromPos || !toPos) continue;

			// Source: right edge of child table (the one with FK)
			const x1 = fromPos.x + TABLE_W;
			const y1 = fromPos.y + HDR_H + (getColIndex(info, fk.from) + 0.5) * COL_H;

			// Target: left edge of parent table
			const x2 = toPos.x;
			const y2 = toPos.y + HDR_H + (getColIndex(tables.get(fk.table)!, fk.to) + 0.5) * COL_H;

			const midX = (x1 + x2) / 2;
			const isFk = true;

			// Line
			const lineColor = isFk ? C.fkLineHl : C.fkLine;
			lines.push(
				`<path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" fill="none" stroke="${lineColor}" stroke-width="1.5" stroke-dasharray="4,3"/>`,
			);

			// Source cardinality: "many" (child table side — line leaves toward parent)
			// Layout: [Table] bar ○ ──line──→ || [Parent]
			const markerR = 4;
			// Bar closer to table edge
			lines.push(
				`<line x1="${x1 - 8}" y1="${y1 - 5}" x2="${x1 - 8}" y2="${y1 + 5}" stroke="${lineColor}" stroke-width="1.5"/>`,
			);
			// Circle between bar and line
			lines.push(
				`<circle cx="${x1 - 14}" cy="${y1}" r="${markerR}" fill="none" stroke="${lineColor}" stroke-width="1.5"/>`,
			);

			// Target cardinality: "one" (parent table side — line arrives at parent)
			lines.push(
				`<line x1="${x2 + 8}" y1="${y2 - 5}" x2="${x2 + 8}" y2="${y2 + 5}" stroke="${lineColor}" stroke-width="1.5"/>`,
			);
			lines.push(
				`<line x1="${x2 + 14}" y1="${y2 - 5}" x2="${x2 + 14}" y2="${y2 + 5}" stroke="${lineColor}" stroke-width="1.5"/>`,
			);
		}
	}

	return lines.join("\n");
}

function getColIndex(info: TableInfo, colName: string): number {
	return info.columns.findIndex((c) => c.name === colName);
}

// ─── Main ───────────────────────────────────────────────────────────────────
function generate(): void {
	if (!fs.existsSync(DB_PATH)) {
		console.error(`Database not found at ${DB_PATH}`);
		console.error('Run the database creation script first: npx tsx scripts/create_db.ts');
		process.exit(1);
	}

	const tables = getSchema(DB_PATH);
	const layers = assignLayers(tables);
	const positions = computePositions(tables, layers);

	// Compute total SVG size
	let maxX = PAD;
	let maxY = TOP;
	for (const [, pos] of positions) {
		const right = pos.x + TABLE_W + PAD;
		const bottom = pos.y + pos.tableHeight + PAD;
		if (right > maxX) maxX = right;
		if (bottom > maxY) maxY = bottom;
	}
	// Add room for FK labels on the right
	maxX += 60;

	const svgParts: string[] = [];

	svgParts.push(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxX} ${maxY}" width="100%" height="100%" style="background:${C.bg}">`,
	);

	// FK lines first (behind tables)
	svgParts.push(drawFK(tables, positions));

	// Table cards
	for (const [name, info] of tables) {
		const pos = positions.get(name)!;
		svgParts.push(drawCard(name, info, pos));
	}

	// Legend (bottom-right)
	const legendX = maxX - 240;
	const legendY = maxY - 80;
	svgParts.push(
		`<rect x="${legendX}" y="${legendY}" width="220" height="60" rx="4" fill="${C.tableBg}" stroke="${C.colBorder}" stroke-width="1"/>`,
	);
	svgParts.push(
		svgText(legendX + 10, legendY + 16, "Legend", C.headerText, 11, "600"),
	);
	svgParts.push(
		svgText(legendX + 10, legendY + 32, "🔑 PK column", C.pkText, 10, "400", "monospace"),
	);
	svgParts.push(
		svgText(legendX + 10, legendY + 48, "↳ FK column  ─ ─ → FK relationship", C.fkText, 10, "400", "monospace"),
	);

	svgParts.push("</svg>");

	fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
	fs.writeFileSync(OUT_PATH, svgParts.join("\n"), "utf-8");
	console.log(`ER diagram SVG written to ${OUT_PATH} (${maxX}x${maxY})`);
}

generate();
