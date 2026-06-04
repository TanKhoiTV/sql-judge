// ─── Central application state ────────────────────────────────────────────
// All module-level state lives here. Changes emit events so extensions and
// UI modules can react without direct coupling.

import { events } from "./events";

// ─── State shape ──────────────────────────────────────────────────────────

export interface AppState {
	db: any;
	SQL: any;
	currentId: string | null;
	currentFilter: string;
	currentSort: string;
	currentSortDir: "asc" | "desc";
	currentMode: "practice" | "sandbox";
	schemaData: Record<string, any> | null;
	cmEditor: any;
	cmSandbox: any;
	activeDbName: string;
	activeDbId: string;
	allExerciseDefs: any[];
	_descriptions: Record<
		string,
		{ description: string; columns: Record<string, string> }
	> | null;
	_bottomResizeTimer: any;
	_mermaidLoading: boolean;
}

const _state: AppState = {
	db: null,
	SQL: null,
	currentId: null,
	currentFilter: "all",
	currentSort: "default",
	currentSortDir: "asc",
	currentMode: "practice",
	schemaData: null,
	cmEditor: null,
	cmSandbox: null,
	activeDbName: "Unilever Product Management",
	activeDbId: "unilever",
	allExerciseDefs: [],
	_descriptions: null,
	_bottomResizeTimer: null,
	_mermaidLoading: false,
};

// ─── Getters / Setters ────────────────────────────────────────────────────

/** Read a single state field. */
export function getState<K extends keyof AppState>(key: K): AppState[K] {
	return _state[key];
}

/** Write a single state field and emit events. */
export function setState<K extends keyof AppState>(
	key: K,
	value: AppState[K],
): void {
	const prev = _state[key];
	_state[key] = value;
	if (prev !== value) {
		events.emit("state:" + key, value, prev);
		events.emit("state:changed", { key, value, prev });
	}
}

/** Reset all state to defaults (used when loading a custom database). */
export function resetState(): void {
	_state.db = null;
	_state.SQL = null;
	_state.currentId = null;
	_state.currentFilter = "all";
	_state.currentSort = "default";
	_state.currentSortDir = "asc";
	_state.schemaData = null;
	_state.cmEditor = null;
	_state.cmSandbox = null;
	_state.allExerciseDefs = [];
	_state._descriptions = null;
	_state._bottomResizeTimer = null;
	_state._mermaidLoading = false;
}
