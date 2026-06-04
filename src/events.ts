// ─── Simple typed event bus ───────────────────────────────────────────────

type Listener = (...args: any[]) => void;

const _listeners: Record<string, Listener[]> = {};

export const events = {
	/** Subscribe to an event. Returns an unsubscribe function. */
	on(event: string, fn: Listener): () => void {
		(_listeners[event] ??= []).push(fn);
		return () => {
			if (_listeners[event]) {
				_listeners[event] = _listeners[event].filter((f) => f !== fn);
			}
		};
	},

	/** Publish an event with arguments. */
	emit(event: string, ...args: any[]): void {
		_listeners[event]?.forEach((fn) => fn(...args));
	},

	/** Remove a specific listener from an event. */
	off(event: string, fn: Listener): void {
		if (_listeners[event]) {
			_listeners[event] = _listeners[event].filter((f) => f !== fn);
		}
	},

	/** Remove all listeners for an event. */
	clear(event: string): void {
		delete _listeners[event];
	},
};
