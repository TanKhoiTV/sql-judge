// ─── Types ────────────────────────────────────────────────────────────────

export interface QueryResult {
	ok: boolean;
	cols?: string[];
	rows?: Record<string, unknown>[];
	rowCount?: number;
	error?: string;
}

export interface JudgeResult {
	pass: boolean;
	issues: string[];
}

// ─── Value normalization ──────────────────────────────────────────────────

export function normalizeValue(v: unknown): string {
	if (v === null || v === undefined) return "";
	if (typeof v === "number") return String(Math.round(v * 1e9) / 1e9);
	return String(v).trim();
}

// ─── Result comparison ────────────────────────────────────────────────────

export function compareResults(
	user: QueryResult,
	ref: QueryResult,
): JudgeResult {
	const issues: string[] = [];

	if (!user.ok) {
		return { pass: false, issues: ["Query failed: " + user.error] };
	}
	if (!ref.ok) {
		return {
			pass: false,
			issues: ["Reference query failed: " + ref.error],
		};
	}

	if (user.cols!.length !== ref.cols!.length) {
		issues.push(
			"Expected " +
				ref.cols!.length +
				" column(s) [" +
				ref.cols!.join(", ") +
				"], got " +
				user.cols!.length +
				" [" +
				user.cols!.join(", ") +
				"]",
		);
	}

	const userLower = user.cols!.map((c) => c.toLowerCase());
	const refLower = ref.cols!.map((c) => c.toLowerCase());
	for (let i = 0; i < Math.min(user.cols!.length, ref.cols!.length); i++) {
		if (userLower[i] !== refLower[i]) {
			issues.push(
				"Column " +
					(i + 1) +
					': expected "' +
					ref.cols![i] +
					'", got "' +
					user.cols![i] +
					'"',
			);
		}
	}

	if (user.rowCount !== ref.rowCount) {
		issues.push(
			"Expected " + ref.rowCount + " row(s), got " + user.rowCount,
		);
	}

	const colCount = Math.min(user.cols!.length, ref.cols!.length);
	const userSet = new Set(
		user.rows!.map((r) =>
			user
				.cols!.slice(0, colCount)
				.map((c) => normalizeValue(r[c]))
				.join("||"),
		),
	);
	const refSet = new Set(
		ref.rows!.map((r) =>
			ref
				.cols!.slice(0, colCount)
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
