// ─── Shared types for SQL Judge ──────────────────────────────────────────

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

export interface ProgressRecord {
	passCount: number;
	attemptCount: number;
	lastPassed: string | null;
}

export interface ExerciseDef {
	id: string;
	title: string;
	difficulty: string;
	tables?: string[];
	question?: string;
	solution: string;
	hint?: string;
}

export interface ColumnInfo {
	name: string;
	type: string;
	pk: boolean;
	notnull: boolean;
	default: any;
}

export interface ForeignKeyInfo {
	from: string;
	table: string;
	to: string;
}

export interface TableInfo {
	columns: ColumnInfo[];
	foreignKeys: ForeignKeyInfo[];
}
