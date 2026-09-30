import { focusGame } from "./FocusGame";
import { I18n } from "./I18n";
import { onRelease } from "./OnRelease";

// The level map, the way ThroughTheDeadCity has it — a sheet of the levels to go to any of those
// open — in this game's own look: the violet card with the gold edge, the gold of the titles, the
// green of "go". Every level a tile: its number on a medallion, the three stars it was passed with
// at best under it, and a word for where it stands — here, passed, next, locked.
//
// Open is a level passed, the one the player is on, and the one after the last passed — "where to
// go next"; the rest is locked: going ahead on the map would skip the dungeon the game is about.
// What is open and the stars the map neither decides nor remembers: it is told (Progress, in the
// platform's cloud), so they outlive a reload and a change of device.
//
// It opens with a button in the top right corner, there only while a level is being played with
// the player on their feet. While the map is open the world under it stands — or the zombies would
// be on the player while they read it. It closes with its cross, a press beside the sheet, or Escape.

export interface LevelMapEntry {
	/** Index of the level, from 0. */
	index: number;
	/** The player is on it now. */
	here: boolean;
	passed: boolean;
	locked: boolean;
	/** The best stars it was passed with, 0..3. */
	stars: number;
}

export class LevelMap {
	private static _root: HTMLDivElement = null;
	private static _list: HTMLDivElement = null;
	private static _title: HTMLDivElement = null;
	private static _total: HTMLDivElement = null;
	private static _button: HTMLButtonElement = null;
	private static _shown = false;
	private static _watch = 0;

	/** The levels as they stand now, asked each time the map opens. */
	static entries: () => LevelMapEntry[] = null;
	/** May the map be opened now: a level is being played, the player on their feet. */
	static canOpen: () => boolean = null;
	/** A level picked. */
	static onPick: (index: number) => void = null;
	/** The map opened or closed: the world stops under it, and goes on after. */
	static onToggle: (open: boolean) => void = null;

	static get shown(): boolean {
		return LevelMap._shown;
	}

	private static get _available(): boolean {
		return typeof document !== "undefined" && !!document.body;
	}

	/** The button in the corner, kept in step with whether the map can be opened. */
	static start(): void {
		if (!LevelMap._available || LevelMap._watch) {
			return;
		}
		LevelMap._build();
		// Checked a few times a second: the screens that hide it — the start, a card, the loading —
		// come and go from many places, and none of them need know about the button.
		LevelMap._watch = setInterval(() => {
			const can = !LevelMap._shown && !!LevelMap.canOpen && LevelMap.canOpen();
			LevelMap._button.hidden = !can;
		}, 200) as unknown as number;
	}

	static show(): void {
		if (LevelMap._shown || !LevelMap._root) {
			return;
		}
		LevelMap._fill();
		LevelMap._shown = true;
		LevelMap._button.hidden = true;
		LevelMap._root.style.display = "flex";
		// The level the player is on in sight: on a long list it may lie below the fold.
		const here = LevelMap._list.querySelector(".tlp-map__tile--here") as HTMLElement;
		LevelMap._list.scrollTop = here ? Math.max(0, here.offsetTop - LevelMap._list.clientHeight / 2 + here.clientHeight / 2) : 0;
		LevelMap.onToggle && LevelMap.onToggle(true);
	}

	static hide(): void {
		if (!LevelMap._shown) {
			return;
		}
		LevelMap._shown = false;
		LevelMap._root.style.display = "none";
		// The keys back to the game: the focus was on the map.
		focusGame();
		LevelMap.onToggle && LevelMap.onToggle(false);
	}

	private static _fill(): void {
		const entries = LevelMap.entries ? LevelMap.entries() : [];
		LevelMap._title.textContent = I18n.t("map.title");
		const earned = entries.reduce((sum, entry) => sum + entry.stars, 0);
		LevelMap._total.textContent = `★ ${earned} / ${entries.length * 3}`;
		const list = LevelMap._list;
		list.textContent = "";
		for (const entry of entries) {
			list.appendChild(LevelMap._tile(entry));
		}
	}

	private static _tile(entry: LevelMapEntry): HTMLButtonElement {
		const tile = document.createElement("button");
		tile.type = "button";
		tile.className = "tlp-map__tile";
		const state = entry.locked ? "locked" : entry.here ? "here" : entry.passed ? "passed" : "next";
		tile.classList.add(`tlp-map__tile--${state}`);
		tile.disabled = entry.locked;

		const medal = document.createElement("span");
		medal.className = "tlp-map__medal";
		medal.innerHTML = entry.locked ? LOCK : "";
		entry.locked || (medal.textContent = String(entry.index + 1));

		// Three stars, the earned ones lit; a level not passed yet has them all dark.
		const stars = document.createElement("span");
		stars.className = "tlp-map__stars";
		for (let i = 0; i < 3; i++) {
			const star = document.createElement("span");
			star.className = "tlp-map__star" + (i < entry.stars ? " tlp-map__star--on" : "");
			star.textContent = "★";
			stars.appendChild(star);
		}

		const mark = document.createElement("span");
		mark.className = "tlp-map__mark";
		mark.textContent = I18n.t(`map.${state}`);

		tile.append(medal, stars, mark);
		tile.setAttribute("aria-label", `${I18n.t("level.title", entry.index + 1)} — ${mark.textContent}`);
		if (!entry.locked) {
			onRelease(tile, () => {
				LevelMap.hide();
				!entry.here && LevelMap.onPick && LevelMap.onPick(entry.index);
			});
		}
		return tile;
	}

	private static _build(): void {
		if (LevelMap._root) {
			return;
		}
		const style = document.createElement("style");
		style.textContent = STYLE;
		document.head.appendChild(style);

		const button = document.createElement("button");
		button.type = "button";
		button.className = "tlp-mapbutton";
		button.hidden = true;
		button.setAttribute("aria-label", I18n.t("map.open"));
		button.innerHTML = MAP_ICON;
		onRelease(button, () => LevelMap.show());
		document.body.appendChild(button);
		LevelMap._button = button;

		const root = document.createElement("div");
		root.className = "tlp-map";
		const sheet = document.createElement("div");
		sheet.className = "tlp-map__sheet";
		const head = document.createElement("div");
		head.className = "tlp-map__head";
		const title = document.createElement("div");
		title.className = "tlp-map__title";
		const total = document.createElement("div");
		total.className = "tlp-map__total";
		const close = document.createElement("button");
		close.type = "button";
		close.className = "tlp-map__close";
		close.setAttribute("aria-label", I18n.t("map.close"));
		close.innerHTML = CROSS;
		onRelease(close, () => LevelMap.hide());
		head.append(title, total, close);
		const list = document.createElement("div");
		list.className = "tlp-map__list";
		sheet.append(head, list);
		root.appendChild(sheet);
		// A press beside the sheet closes it, as any sheet.
		root.addEventListener("pointerdown", (event) => event.target === root && LevelMap.hide());
		document.body.appendChild(root);
		// Escape, as everything else; before the engine, which keeps the keys to itself.
		addEventListener("keydown", (event: KeyboardEvent) => LevelMap._shown && event.code === "Escape" && LevelMap.hide(), { capture: true });

		LevelMap._root = root;
		LevelMap._title = title;
		LevelMap._total = total;
		LevelMap._list = list;
	}
}

/** The button's picture: a folded map with a path of dots on it. */
const MAP_ICON =
	'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.5 6.2l5.5-2.2 6 2.2 5.5-2.2v13.8l-5.5 2.2-6-2.2-5.5 2.2z" fill="none" stroke="#ffe066" stroke-width="2.2" stroke-linejoin="round"/><path d="M9 4v13.8M15 6.2V20" fill="none" stroke="#ffe066" stroke-width="1.6" opacity="0.55"/><circle cx="6.3" cy="14.5" r="1.3" fill="#ff6b5e"/><circle cx="12" cy="11" r="1.3" fill="#ffe066"/><circle cx="17.8" cy="8" r="1.3" fill="#8dff5e"/></svg>';
const LOCK =
	'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="#8c80b8"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#8c80b8" stroke-width="2.6"/><circle cx="12" cy="15.3" r="1.6" fill="#2b2160"/></svg>';
const CROSS =
	'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg>';

const STYLE = `
.tlp-mapbutton {
	position: fixed; z-index: 9980;
	top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right));
	width: 52px; height: 52px; padding: 0; box-sizing: border-box; border-radius: 16px; cursor: pointer;
	display: flex; align-items: center; justify-content: center;
	background: linear-gradient(180deg, #3b2a6e 0%, #241a47 100%);
	border: 3px solid #ffcf4a;
	box-shadow: 0 5px 0 #16102d, 0 10px 18px rgba(0, 0, 0, 0.45), inset 0 2px 0 rgba(255, 255, 255, 0.15);
	transition: scale 80ms ease-out;
	-webkit-tap-highlight-color: transparent;
}
.tlp-mapbutton[hidden] { display: none; }
.tlp-mapbutton:active { scale: 0.92; }
.tlp-mapbutton svg { width: 30px; height: 30px; filter: drop-shadow(0 2px 0 #16102d); }
.tlp-map {
	position: fixed; inset: 0; z-index: 9985;
	display: none; align-items: center; justify-content: center; box-sizing: border-box;
	padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
	background: radial-gradient(ellipse at center, rgba(40, 18, 70, 0.72) 0%, rgba(8, 6, 20, 0.9) 80%);
	pointer-events: all; user-select: none; -webkit-user-select: none;
	font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.tlp-map__sheet {
	width: min(460px, 100%); max-height: 100%; box-sizing: border-box;
	padding: clamp(12px, 3.5vmin, 20px); border-radius: clamp(18px, 5vmin, 26px);
	display: flex; flex-direction: column;
	background: linear-gradient(180deg, #3b2a6e 0%, #241a47 100%);
	border: 3px solid #ffcf4a;
	box-shadow: 0 10px 0 #16102d, 0 18px 40px rgba(0, 0, 0, 0.55), inset 0 2px 0 rgba(255, 255, 255, 0.15);
	animation: tlp-map-pop 0.3s cubic-bezier(0.2, 1.4, 0.4, 1) both;
}
.tlp-map__head { display: flex; flex-direction: column; align-items: center; position: relative; margin-bottom: clamp(10px, 3vmin, 16px); flex-shrink: 0; }
.tlp-map__title {
	color: #ffe066; font-size: clamp(22px, 7vmin, 30px); line-height: 1.1; font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase;
	text-shadow: 0 3px 0 #b8560f, 0 6px 12px rgba(0, 0, 0, 0.5);
}
.tlp-map__total {
	margin-top: 6px; padding: 3px 12px; border-radius: 999px; background: rgba(0, 0, 0, 0.25);
	color: #ffd23f; font-size: clamp(13px, 3.8vmin, 16px); font-weight: 900; letter-spacing: 0.04em;
	text-shadow: 0 2px 0 #7a3c0a;
}
.tlp-map__close {
	position: absolute; right: 0; top: 0;
	width: 40px; height: 40px; padding: 0; border: 3px solid #fff; border-radius: 50%; cursor: pointer;
	display: flex; align-items: center; justify-content: center;
	background: linear-gradient(180deg, #ff6b5e 0%, #d8231b 100%);
	box-shadow: 0 4px 0 #7a1414, 0 8px 14px rgba(0, 0, 0, 0.4);
	transition: scale 80ms ease-out; -webkit-tap-highlight-color: transparent;
}
.tlp-map__close svg { width: 18px; height: 18px; filter: drop-shadow(0 2px 0 #7a1414); }
.tlp-map__close:active { scale: 0.9; }
.tlp-map__list {
	display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(8px, 2.2vmin, 12px);
	position: relative; padding: 4px 2px 8px;
	min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; touch-action: pan-y;
}
.tlp-map__list::-webkit-scrollbar { display: none; }
.tlp-map__tile {
	position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px;
	min-width: 0; padding: clamp(10px, 2.6vmin, 14px) 6px clamp(8px, 2.2vmin, 12px); box-sizing: border-box;
	border: 2px solid rgba(255, 255, 255, 0.1); border-radius: 18px; cursor: pointer;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.04) 100%);
	box-shadow: 0 4px 0 rgba(22, 16, 45, 0.9);
	color: #fff; font-family: inherit;
	transition: scale 80ms ease-out; -webkit-tap-highlight-color: transparent;
}
.tlp-map__tile:active { scale: 0.94; }
.tlp-map__medal {
	width: clamp(46px, 13vmin, 58px); height: clamp(46px, 13vmin, 58px); border-radius: 50%;
	display: flex; align-items: center; justify-content: center;
	background: linear-gradient(180deg, #8dff5e 0%, #36c22a 100%);
	border: 3px solid #fff; box-sizing: border-box;
	color: #fff; font-size: clamp(20px, 6vmin, 26px); font-weight: 900; text-shadow: 0 2px 0 #1d7a14;
	box-shadow: 0 4px 0 #1d7a14, inset 0 2px 0 rgba(255, 255, 255, 0.5);
}
.tlp-map__medal svg { width: 60%; height: 60%; }
.tlp-map__stars { display: flex; align-items: flex-end; gap: 1px; line-height: 1; }
.tlp-map__star { font-size: clamp(15px, 4.4vmin, 19px); color: #4a3c86; text-shadow: 0 2px 0 #16102d; }
.tlp-map__star:nth-child(2) { font-size: clamp(19px, 5.4vmin, 23px); margin-bottom: 2px; }
.tlp-map__star--on { color: #ffd23f; text-shadow: 0 2px 0 #b8560f, 0 0 8px rgba(255, 210, 63, 0.55); }
.tlp-map__mark {
	padding: 2px 8px; border-radius: 999px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	font-size: clamp(10px, 2.9vmin, 12px); font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase;
	background: rgba(0, 0, 0, 0.28); color: #c9b8ff;
}
/* Passed: a quiet medallion, the stars say how well. */
.tlp-map__tile--passed .tlp-map__medal { background: linear-gradient(180deg, #7a6bc4 0%, #4d3f94 100%); text-shadow: 0 2px 0 #2b2160; box-shadow: 0 4px 0 #2b2160, inset 0 2px 0 rgba(255, 255, 255, 0.35); }
/* Here: gold all round, and a beat. */
.tlp-map__tile--here { border-color: #ffcf4a; background: linear-gradient(180deg, rgba(255, 207, 74, 0.28) 0%, rgba(255, 207, 74, 0.08) 100%); animation: tlp-map-here 1.4s ease-in-out infinite; }
.tlp-map__tile--here .tlp-map__medal { background: linear-gradient(180deg, #ffe066 0%, #f0a21a 100%); text-shadow: 0 2px 0 #9a4f0a; box-shadow: 0 4px 0 #9a4f0a, inset 0 2px 0 rgba(255, 255, 255, 0.6); }
.tlp-map__tile--here .tlp-map__mark { background: #ffcf4a; color: #5a2c05; }
/* Next: the green of "go". */
.tlp-map__tile--next { border-color: rgba(141, 255, 94, 0.55); }
.tlp-map__tile--next .tlp-map__mark { background: #36c22a; color: #fff; text-shadow: 0 1px 0 #1d7a14; }
/* Locked: dark, a padlock in place of the number. */
.tlp-map__tile--locked { cursor: default; background: rgba(0, 0, 0, 0.25); border-color: transparent; box-shadow: none; }
.tlp-map__tile--locked:active { scale: none; }
.tlp-map__tile--locked .tlp-map__medal { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.12); box-shadow: none; }
.tlp-map__tile--locked .tlp-map__star { color: #2e2656; text-shadow: none; }
.tlp-map__tile--locked .tlp-map__mark { color: #8c80b8; }
@keyframes tlp-map-pop { from { transform: scale(0.85); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes tlp-map-here { 0%, 100% { box-shadow: 0 4px 0 rgba(22, 16, 45, 0.9), 0 0 0 0 rgba(255, 207, 74, 0.45); } 50% { box-shadow: 0 4px 0 rgba(22, 16, 45, 0.9), 0 0 0 6px rgba(255, 207, 74, 0); } }
/* A phone on its side: a wider sheet, the levels in more columns. */
@media (orientation: landscape) and (max-height: 540px) {
	.tlp-map__sheet { width: min(720px, 100%); padding: 10px 14px 12px; }
	.tlp-map__head { margin-bottom: 8px; }
	.tlp-map__title { font-size: 22px; }
	.tlp-map__list { grid-template-columns: repeat(6, 1fr); gap: 8px; }
	.tlp-map__medal { width: 42px; height: 42px; font-size: 19px; }
}
`;
