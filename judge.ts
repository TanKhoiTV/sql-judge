#!/usr/bin/env node
/**
 * SQL Query Judge - Practice SQL by comparing your queries against reference solutions.
 *
 * Usage:
 *   npx tsx judge.ts list                 — List all exercises
 *   npx tsx judge.ts show <id>            — Show the question for an exercise
 *   npx tsx judge.ts solve <id> "SELECT..." — Submit a query inline
 *   npx tsx judge.ts solve <id> -f query.sql — Submit a query from file
 *   npx tsx judge.ts random               — Pick a random exercise
 *   npx tsx judge.ts solve <id>           — Interactive mode (prompts for query)
 */

import { DatabaseSync } from "node:sqlite";
import * as path from "node:path";
import * as fs from "node:fs";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(
  __dirname,
  "public",
  "db",
  "Unilever_Product_Management.db",
);
const EXERCISES_PATH = path.join(
  __dirname,
  "public",
  "exercises",
  "exercises.json",
);

interface Exercise {
  id: string;
  title: string;
  difficulty: string;
  tables?: string[];
  question?: string;
  solution: string;
  hint?: string;
}

interface QueryResult {
  ok: boolean;
  cols?: string[];
  rows?: Record<string, unknown>[];
  rowCount?: number;
  error?: string;
}

interface JudgeResult {
  pass: boolean;
  issues: string[];
}

const exercises: Exercise[] = JSON.parse(
  fs.readFileSync(EXERCISES_PATH, "utf8"),
);

// ─── Database helpers ─────────────────────────────────────────────────────

function runQuery(sql: string): QueryResult {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON");
  try {
    const stmt = db.prepare(sql);
    const cols = stmt.columns().map((c: { name: string }) => c.name);
    const rows = stmt.all();
    return { ok: true, cols, rows, rowCount: rows.length };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  } finally {
    db.close();
  }
}

// ─── Result comparison ────────────────────────────────────────────────────

function normalizeValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(Math.round(v * 1e9) / 1e9);
  return String(v).trim();
}

function compareResults(user: QueryResult, ref: QueryResult): JudgeResult {
  const issues: string[] = [];

  if (!user.ok) {
    return { pass: false, issues: [`[ERROR] Query failed: ${user.error}`] };
  }

  if (user.cols!.length !== ref.cols!.length) {
    issues.push(
      `[COLUMNS] Expected ${ref.cols!.length} column(s) [${ref.cols!.join(", ")}], ` +
        `but got ${user.cols!.length} [${user.cols!.join(", ")}]`,
    );
  }

  const userColsLower = user.cols!.map((c) => c.toLowerCase());
  const refColsLower = ref.cols!.map((c) => c.toLowerCase());
  for (let i = 0; i < Math.min(user.cols!.length, ref.cols!.length); i++) {
    if (userColsLower[i] !== refColsLower[i]) {
      issues.push(
        `[COLUMN ${i + 1}] Expected "${ref.cols![i]}" but got "${user.cols![i]}"`,
      );
    }
  }

  if (user.rowCount !== ref.rowCount) {
    issues.push(
      `[ROWS] Expected ${ref.rowCount} row(s), but got ${user.rowCount}`,
    );
  }

  const userColCount = Math.min(user.cols!.length, ref.cols!.length);

  const userSet = new Set<string>();
  for (const row of user.rows!) {
    const key = user
      .cols!.slice(0, userColCount)
      .map((c) => normalizeValue(row[c]))
      .join("||");
    userSet.add(key);
  }
  const refSet = new Set<string>();
  for (const row of ref.rows!) {
    const key = ref
      .cols!.slice(0, userColCount)
      .map((c) => normalizeValue(row[c]))
      .join("||");
    refSet.add(key);
  }

  const missing = [...refSet].filter((k) => !userSet.has(k));
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

function pad(s: unknown, n: number): string {
  return String(s).padEnd(n);
}

function printTable(cols: string[], rows: Record<string, unknown>[], maxRows = 15): void {
  const widths = cols.map((c) => {
    const dataMax = Math.max(
      ...rows.slice(0, maxRows).map((r) => String(r[c] ?? "").length),
    );
    return Math.max(c.length, dataMax, 5);
  });

  const header = cols.map((c, i) => pad(c, widths[i])).join(" | ");
  console.log(header);
  console.log("-".repeat(header.length));

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

function cmdList(): void {
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
  console.log(`\n  Usage: npx tsx judge.ts show <id>`);
  console.log(`  Usage: npx tsx judge.ts solve <id> "YOUR SQL"`);
}

function cmdShow(id: string): void {
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

function cmdSolve(id: string, userQuery?: string | null): void {
  const ex = exercises.find((e) => e.id === id);
  if (!ex) {
    console.log(`Exercise "${id}" not found.`);
    return;
  }

  if (!userQuery) {
    cmdShow(id);
    console.log(
      "  Enter your SQL query below (end with Ctrl+D or empty line + Ctrl+D):\n",
    );
    const rl = readline.createInterface({ input: process.stdin });
    const lines: string[] = [];
    rl.on("line", (l: string) => lines.push(l));
    rl.on("close", () => {
      const input = lines.join("\n").trim();
      if (input) judge(ex, input);
    });
    return;
  }

  judge(ex, userQuery);
}

function judge(ex: Exercise, userQuery: string): void {
  console.log(`\n  ╔══════════════════════════════════════════════╗`);
  console.log(`  ║  Exercise: ${ex.id.padEnd(37)}║`);
  console.log(`  ║  ${ex.title.padEnd(46)}║`);
  console.log(`  ╚══════════════════════════════════════════════╝\n`);

  console.log("  📝 Your query:");
  console.log(`  ${userQuery.replace(/\n/g, "\n  ")}\n`);

  const user = runQuery(userQuery);
  if (!user.ok) {
    console.log(`  ❌ Query error: ${user.error}\n`);
    return;
  }

  console.log(`  ✅ Query executed: ${user.rowCount} row(s) returned\n`);
  if (user.rowCount! > 0 && user.rowCount! <= 10) {
    printTable(user.cols!, user.rows!, 10);
    console.log("");
  }

  const ref = runQuery(ex.solution);
  console.log("  🔍 Judging...\n");
  const { pass, issues } = compareResults(user, ref);

  if (pass) {
    console.log(`  ✅ ✅ ✅  PASS!  ✅ ✅ ✅\n`);
    console.log("  Your query matches the reference solution.\n");
    console.log("  Reference solution:");
    console.log(`  ${ex.solution.replace(/\n/g, "\n  ")}\n`);
    if (ref.rowCount! > 0 && ref.rowCount! <= 10) {
      console.log("  Expected output:");
      printTable(ref.cols!, ref.rows!, 10);
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
    console.log("  Reference solution:");
    console.log(`  ${ex.solution.replace(/\n/g, "\n  ")}\n`);
    if (ref.rowCount! > 0 && ref.rowCount! <= 10) {
      console.log("  Expected output:");
      printTable(ref.cols!, ref.rows!, 10);
      console.log("");
    }
    console.log("  Your output:");
    if (user.rowCount! > 0 && user.rowCount! <= 10) {
      printTable(user.cols!, user.rows!, 10);
    }
    console.log("");
  }
}

function cmdRandom(): void {
  const ex = exercises[Math.floor(Math.random() * exercises.length)];
  cmdShow(ex.id);
}

// ─── Main CLI ─────────────────────────────────────────────────────────────

function main(): void {
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
      console.log(`Usage: npx tsx judge.ts [list|show|solve|random]`);
  }
}

main();
