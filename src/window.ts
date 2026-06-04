// ─── Window exposure helpers ──────────────────────────────────────────────
// With esbuild --bundle, function declarations are scoped inside the IIFE
// and not visible to onclick attributes in index.html or generated HTML strings.
// These helpers register functions and state getters on the window object.

const _w = window as any;

/**
 * Expose a stable function reference to window for use in onclick handlers.
 * Works for functions that are never reassigned after registration.
 */
export function expose(name: string, fn: Function): void {
	_w[name] = fn;
}

/**
 * Expose a live getter to window for module-level values that may be
 * reassigned after registration (e.g., cmEditor, cmSandbox).
 * Uses Object.defineProperty so the window reference stays live.
 */
export function exposeState(name: string, getter: () => any): void {
	Object.defineProperty(_w, name, { get: getter, configurable: true });
}
