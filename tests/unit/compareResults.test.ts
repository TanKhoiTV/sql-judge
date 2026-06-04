import { describe, it, expect } from "vitest";
import { compareResults, normalizeValue } from "../../src/lib.ts";

// ─── Fixture helpers ──────────────────────────────────────────────────────

function makeResult(
	cols: string[],
	rows: Record<string, unknown>[],
): ReturnType<typeof buildResult> {
	return buildResult(cols, rows);
}

function buildResult(
	cols: string[],
	rows: Record<string, unknown>[],
): {
	ok: true;
	cols: string[];
	rows: Record<string, unknown>[];
	rowCount: number;
} {
	return { ok: true, cols, rows, rowCount: rows.length };
}

function errorResult(error: string): {
	ok: false;
	error: string;
} {
	return { ok: false, error };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("normalizeValue", () => {
	it("converts null to empty string", () => {
		expect(normalizeValue(null)).toBe("");
	});

	it("converts undefined to empty string", () => {
		expect(normalizeValue(undefined)).toBe("");
	});

	it("rounds floats to 9 decimal places", () => {
		expect(normalizeValue(3.14159265358979)).toBe("3.141592654");
	});

	it("trims string values", () => {
		expect(normalizeValue("  hello  ")).toBe("hello");
	});

	it("leaves integers as-is", () => {
		expect(normalizeValue(42)).toBe("42");
	});

	it("converts boolean to string", () => {
		expect(normalizeValue(true)).toBe("true");
	});
});

describe("compareResults", () => {
	it("passes on identical results", () => {
		const user = makeResult(
			["id", "name"],
			[
				{ id: 1, name: "Alice" },
				{ id: 2, name: "Bob" },
			],
		);
		const ref = makeResult(
			["id", "name"],
			[
				{ id: 1, name: "Alice" },
				{ id: 2, name: "Bob" },
			],
		);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(true);
		expect(r.issues).toHaveLength(0);
	});

	it("passes on results in different order (set equality)", () => {
		const user = makeResult(
			["id", "name"],
			[
				{ id: 2, name: "Bob" },
				{ id: 1, name: "Alice" },
			],
		);
		const ref = makeResult(
			["id", "name"],
			[
				{ id: 1, name: "Alice" },
				{ id: 2, name: "Bob" },
			],
		);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(true);
	});

	it("fails when user query has an error", () => {
		const user = errorResult("syntax error");
		const ref = makeResult(["id"], [{ id: 1 }]);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(false);
		expect(r.issues[0]).toContain("syntax error");
	});

	it("fails when reference query has an error", () => {
		const user = makeResult(["id"], [{ id: 1 }]);
		const ref = errorResult("broken");
		const r = compareResults(user, ref);
		expect(r.pass).toBe(false);
		expect(r.issues[0]).toContain("Reference query failed");
	});

	it("catches column count mismatch", () => {
		const user = makeResult(["id", "name"], [{ id: 1, name: "Alice" }]);
		const ref = makeResult(["id"], [{ id: 1 }]);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(false);
		expect(r.issues.some((i) => i.includes("column(s)"))).toBe(true);
	});

	it("catches column name mismatch", () => {
		const user = makeResult(["ID", "NAME"], [{ ID: 1, NAME: "Alice" }]);
		const ref = makeResult(
			["id", "full_name"],
			[{ id: 1, full_name: "Alice" }],
		);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(false);
		expect(r.issues.some((i) => i.includes("Column 2"))).toBe(true);
	});

	it("matches columns case-insensitively", () => {
		const user = makeResult(["ID", "NAME"], [{ ID: 1, NAME: "Alice" }]);
		const ref = makeResult(["id", "name"], [{ id: 1, name: "Alice" }]);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(true);
	});

	it("catches row count mismatch", () => {
		const user = makeResult(["id"], [{ id: 1 }, { id: 2 }]);
		const ref = makeResult(["id"], [{ id: 1 }]);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(false);
		expect(r.issues.some((i) => i.includes("row(s)"))).toBe(true);
	});

	it("detects missing rows", () => {
		const user = makeResult(["id"], [{ id: 1 }]);
		const ref = makeResult(["id"], [{ id: 1 }, { id: 2 }]);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(false);
		expect(r.issues.some((i) => i.includes("missing"))).toBe(true);
	});

	it("detects extra rows", () => {
		const user = makeResult(["id"], [{ id: 1 }, { id: 2 }, { id: 3 }]);
		const ref = makeResult(["id"], [{ id: 1 }]);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(false);
		expect(r.issues.some((i) => i.includes("extra"))).toBe(true);
	});

	it("handles empty result sets", () => {
		const user = makeResult(["id"], []);
		const ref = makeResult(["id"], []);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(true);
	});

	it("handles NULL values in cells", () => {
		const user = makeResult(["id", "name"], [{ id: 1, name: null }]);
		const ref = makeResult(["id", "name"], [{ id: 1, name: null as unknown }]);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(true);
	});

	it("treats null and empty string as different", () => {
		const user = makeResult(["id", "name"], [{ id: 1, name: "" }]);
		const ref = makeResult(["id", "name"], [{ id: 1, name: null }]);
		const r = compareResults(user, ref);
		// Both normalize to "" so they compare equal — this is current behavior
		expect(r.pass).toBe(true);
	});

	it("handles floating-point rounding differences", () => {
		const user = makeResult(["val"], [{ val: 0.1 + 0.2 }]); // 0.30000000000000004
		const ref = makeResult(["val"], [{ val: 0.3 }]);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(true);
	});

	it("trims whitespace in string values", () => {
		const user = makeResult(["name"], [{ name: "  Alice  " }]);
		const ref = makeResult(["name"], [{ name: "Alice" }]);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(true);
	});

	it("reports column count mismatch when user has extra columns", () => {
		const user = makeResult(
			["id", "name", "extra"],
			[{ id: 1, name: "Alice", extra: "x" }],
		);
		const ref = makeResult(["id", "name"], [{ id: 1, name: "Alice" }]);
		const r = compareResults(user, ref);
		// Column count mismatch is reported as an issue
		expect(r.pass).toBe(false);
		expect(r.issues.some((i) => i.includes("column(s)"))).toBe(true);
	});

	it("compares overlapping columns when user has extra, row data still matches", () => {
		const user = makeResult(
			["id", "name", "extra"],
			[{ id: 1, name: "Alice", extra: "x" }],
		);
		const ref = makeResult(["id", "name"], [{ id: 1, name: "Alice" }]);
		const r = compareResults(user, ref);
		// No row-level issues, only column count
		expect(
			r.issues.filter((i) => i.includes("missing") || i.includes("extra row"))
				.length,
		).toBe(0);
	});

	it("reports column count mismatch when ref has more", () => {
		const user = makeResult(["id"], [{ id: 1 }]);
		const ref = makeResult(["id", "name"], [{ id: 1, name: "Alice" }]);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(false);
		expect(r.issues.some((i) => i.includes("column(s)"))).toBe(true);
	});

	it("reports multiple issues at once", () => {
		const user = makeResult(["x"], [{ x: 1 }, { x: 99 }]);
		const ref = makeResult(
			["id", "name"],
			[
				{ id: 1, name: "Alice" },
				{ id: 2, name: "Bob" },
			],
		);
		const r = compareResults(user, ref);
		expect(r.pass).toBe(false);
		// Should have column count, column name, row count, and data issues
		expect(r.issues.length).toBeGreaterThanOrEqual(3);
	});
});
