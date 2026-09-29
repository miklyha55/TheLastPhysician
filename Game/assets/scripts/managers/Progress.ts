import type { StackItem } from "./GameState";
import { Yandex } from "./Yandex";

// The player's progress, the way ThroughTheDeadCity keeps it: in the platform's cloud, not in the
// browser — the platform asks that a player who reloads the page goes on where they stopped and
// loses nothing, and a browser's storage goes with its first cleaning. Off the platform Yandex
// keeps it in the browser instead, so a preview plays the same.
//
// What is kept: the level the player is on; how far they have got — every level up to it is open
// on the level map; the stack each level was last entered with — potions and keys, bottom to top,
// laid back on the player whether the level is gone on to, played again from the map, or the
// game reopened on it; and the run's totals, for the final screen after a game played in sittings.
//
// One object in memory is the truth for the game, and it is written whole, on events — a level
// entered, a level passed, the game wiped — never on a timer: the platform limits writes, and the
// ones that come close together go as one, a moment later. The page going sends what is waiting.

/** Seconds a write waits, so that the ones close together go as one. */
const SAVE_AFTER = 1.5;

export interface ProgressState {
	/** Index of the level the player is on. */
	level: number;
	/** How many levels are open: every one below this index. */
	reached: number;
	/** The stack each level was last entered with, by its index; none — the level's own start. */
	entries: { [level: string]: StackItem[] };
	/** The run's totals so far; null — none yet. */
	totals: { [name: string]: number } | null;
}

function fresh(): ProgressState {
	return { level: 0, reached: 1, entries: {}, totals: null };
}

export class Progress {
	private static _state: ProgressState = fresh();
	private static _loaded = false;
	private static _loading: Promise<void> = null;
	private static _pending = 0;

	/** Reads what was saved — once, at the start; asked again, the same promise. */
	static load(): Promise<void> {
		if (!Progress._loading) {
			Progress._loading = Yandex.loadData().then((saved) => {
				Progress._state = Progress._clean(saved);
				Progress._loaded = true;
				Progress._saveOnLeave();
			});
		}
		return Progress._loading;
	}

	/** Index of the level the player is on. */
	static get level(): number {
		return Progress._state.level;
	}

	/** How many levels are open, from the first: at least one. */
	static get reached(): number {
		return Progress._state.reached;
	}

	/** The run's totals as saved; null — none. */
	static get totals(): { [name: string]: number } | null {
		return Progress._state.totals;
	}

	/** What the player enters level `index` with; null — the level's own start. */
	static entry(index: number): StackItem[] {
		const stack = Progress._state.entries[String(index)];
		return stack ? stack.map((item) => ({ key: item.key, color: item.color })) : null;
	}

	/**
	 * The player is on level `index` now. `stack` — what they came in with, kept for the level
	 * from now on; undefined — as it was kept (the level played again, from the map).
	 */
	static enter(index: number, stack?: StackItem[]): void {
		if (index < 0) {
			return;
		}
		const state = Progress._state;
		let changed = state.level !== index;
		state.level = index;
		if (stack !== undefined) {
			const key = String(index);
			const before = JSON.stringify(state.entries[key] || null);
			stack ? (state.entries[key] = stack.map((item) => ({ key: item.key, color: item.color }))) : delete state.entries[key];
			changed = changed || before !== JSON.stringify(stack || null);
		}
		if (index + 1 > state.reached) {
			state.reached = index + 1;
			changed = true;
		}
		changed && Progress._save();
	}

	/** Level `index` passed: the next one opens. */
	static pass(index: number, totals: { [name: string]: number }): void {
		const state = Progress._state;
		state.reached = Math.max(state.reached, index + 2);
		state.totals = { ...totals };
		Progress._save();
	}

	/** Everything wiped — "start over" from a death: the levels passed are lost, as it warns. */
	static wipe(): void {
		Progress._state = fresh();
		Progress._save(true);
	}

	/**
	 * A new run after the game is won: from the first level with fresh totals, and the map left
	 * open — the levels are passed, and nothing warned they would be lost.
	 */
	static newRun(): void {
		const state = Progress._state;
		state.level = 0;
		state.totals = null;
		Progress._save(true);
	}

	/** Sends what waits at once: the page is going. */
	static flush(): void {
		if (!Progress._pending) {
			return;
		}
		clearTimeout(Progress._pending);
		Progress._pending = 0;
		Yandex.saveData(Progress._state, true);
	}

	private static _save(now = false): void {
		// Not read yet — then there is nothing to write over what was saved.
		if (!Progress._loaded) {
			return;
		}
		clearTimeout(Progress._pending);
		Progress._pending = 0;
		if (now) {
			Yandex.saveData(Progress._state, true);
			return;
		}
		Progress._pending = setTimeout(() => {
			Progress._pending = 0;
			Yandex.saveData(Progress._state);
		}, SAVE_AFTER * 1000) as unknown as number;
	}

	/** The tab hidden or the page going: on a phone the page's closing never comes, its hiding always does. */
	private static _saveOnLeave(): void {
		if (typeof document === "undefined") {
			return;
		}
		document.addEventListener("visibilitychange", () => document.hidden && Progress.flush());
		addEventListener("pagehide", () => Progress.flush());
	}

	/** What came from the cloud, made safe: it outlives versions of the game, and anything may be in it. */
	private static _clean(saved: { [key: string]: unknown }): ProgressState {
		const state = fresh();
		const whole = (value: unknown, least: number) => (typeof value === "number" && isFinite(value) ? Math.max(least, Math.floor(value)) : least);
		state.level = whole(saved.level, 0);
		state.reached = Math.max(whole(saved.reached, 1), state.level + 1);
		const entries = saved.entries;
		if (entries && typeof entries === "object") {
			for (const [key, stack] of Object.entries(entries as object)) {
				if (Array.isArray(stack) && /^\d+$/.test(key)) {
					state.entries[key] = stack
						.filter((item) => item && typeof item === "object")
						.map((item) => ({ key: !!item.key, color: typeof item.color === "number" ? item.color : -1 }));
				}
			}
		}
		const totals = saved.totals;
		if (totals && typeof totals === "object") {
			state.totals = {};
			for (const [name, value] of Object.entries(totals as object)) {
				typeof value === "number" && isFinite(value) && (state.totals[name] = value);
			}
		}
		return state;
	}
}
