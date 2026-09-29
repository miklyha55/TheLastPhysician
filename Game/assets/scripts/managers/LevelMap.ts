import { focusGame } from "./FocusGame";
import { I18n } from "./I18n";
import { onRelease } from "./OnRelease";

// The level map, the way ThroughTheDeadCity has it, in this game's own look — the card of the
// results: a sheet of the levels, from which the player may go to any of those open. Open is a
// level passed, the one the player is on, and the one after the last passed — "where to go next";
// the rest is locked: going ahead on the map would skip the dungeon the game is about. What is open
// the map neither decides nor remembers: it is told (Progress, in the platform's cloud), so the
// locks outlive a reload and a change of device.
//
// It opens with a button in the top right corner, in the row of the game's own things over the
// canvas; the button is there only while a level is being played. While the map is open the world
// under it stands — or the zombies would be on the player while they read it. It closes with its
// cross, a press beside the sheet, or Escape.

export interface LevelMapEntry {
	/** Index of the level, from 0. */
	index: number;
	/** The player is on it now. */
	here: boolean;
	passed: boolean;
	locked: boolean;
}

export class LevelMap {
	private static _root: HTMLDivElement = null;
	private static _list: HTMLDivElement = null;
	private static _title: HTMLDivElement = null;
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
		LevelMap._list.scrollTop = 0;
		LevelMap.onToggle && LevelMap.onToggle(true);
	}

	static hide(): void {
		if (!LevelMap._shown) {
			return;
		}
		LevelMap._shown = false;
		LevelMap._root.style.display = "none";
		// The keys back to the game: the focus was on the map's button.
		focusGame();
		LevelMap.onToggle && LevelMap.onToggle(false);
	}

	private static _fill(): void {
		LevelMap._title.textContent = I18n.t("map.title");
		const list = LevelMap._list;
		list.textContent = "";
		for (const entry of LevelMap.entries ? LevelMap.entries() : []) {
			list.appendChild(LevelMap._card(entry));
		}
	}

	private static _card(entry: LevelMapEntry): HTMLButtonElement {
		const card = document.createElement("button");
		card.type = "button";
		card.className = "tlp-map__card";
		entry.here && card.classList.add("tlp-map__card--here");
		entry.passed && card.classList.add("tlp-map__card--passed");
		entry.locked && card.classList.add("tlp-map__card--locked");
		card.disabled = entry.locked;
		const number = document.createElement("span");
		number.className = "tlp-map__number";
		number.textContent = entry.locked ? "🔒" : String(entry.index + 1);
		const name = document.createElement("span");
		name.className = "tlp-map__name";
		name.textContent = I18n.t("level.title", entry.index + 1);
		// One mark: "here" says more than "passed", and the lock says why it does not press.
		const mark = document.createElement("span");
		mark.className = "tlp-map__mark";
		mark.textContent = entry.locked ? I18n.t("map.locked") : entry.here ? I18n.t("map.here") : entry.passed ? I18n.t("map.passed") : I18n.t("map.next");
		card.append(number, name, mark);
		if (!entry.locked) {
			onRelease(card, () => {
				LevelMap.hide();
				!entry.here && LevelMap.onPick && LevelMap.onPick(entry.index);
			});
		}
		return card;
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
		for (let i = 0; i < 3; i++) {
			const line = document.createElement("span");
			line.className = "tlp-mapbutton__line";
			button.appendChild(line);
		}
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
		const close = document.createElement("button");
		close.type = "button";
		close.className = "tlp-map__close";
		close.textContent = "✕";
		onRelease(close, () => LevelMap.hide());
		head.append(title, close);
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
		LevelMap._list = list;
	}
}

const STYLE = `
.tlp-mapbutton {
	position: fixed; z-index: 9980;
	top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right));
	width: 48px; height: 48px; padding: 0; box-sizing: border-box; border-radius: 14px; cursor: pointer;
	display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;
	background: linear-gradient(180deg, #3b2a6e 0%, #241a47 100%);
	border: 3px solid #ffcf4a;
	box-shadow: 0 4px 0 #16102d, 0 8px 16px rgba(0, 0, 0, 0.45);
	transition: scale 80ms ease-out;
	-webkit-tap-highlight-color: transparent;
}
.tlp-mapbutton[hidden] { display: none; }
.tlp-mapbutton:active { scale: 0.92; }
.tlp-mapbutton__line { display: block; width: 22px; height: 3px; border-radius: 2px; background: #ffe066; box-shadow: 0 1px 0 #b8560f; }
.tlp-map {
	position: fixed; inset: 0; z-index: 9985;
	display: none; align-items: center; justify-content: center; box-sizing: border-box;
	padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
	background: radial-gradient(ellipse at center, rgba(40, 18, 70, 0.72) 0%, rgba(8, 6, 20, 0.9) 80%);
	pointer-events: all; user-select: none; -webkit-user-select: none;
	font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.tlp-map__sheet {
	width: min(440px, 100%); max-height: 100%; box-sizing: border-box;
	padding: clamp(12px, 3.5vmin, 20px); border-radius: clamp(18px, 5vmin, 26px);
	display: flex; flex-direction: column;
	background: linear-gradient(180deg, #3b2a6e 0%, #241a47 100%);
	border: 3px solid #ffcf4a;
	box-shadow: 0 10px 0 #16102d, 0 18px 40px rgba(0, 0, 0, 0.55), inset 0 2px 0 rgba(255, 255, 255, 0.15);
}
.tlp-map__head { display: flex; align-items: center; justify-content: center; position: relative; margin-bottom: clamp(10px, 3vmin, 16px); flex-shrink: 0; }
.tlp-map__title {
	color: #ffe066; font-size: clamp(20px, 6.5vmin, 28px); line-height: 1.1; font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase;
	text-shadow: 0 3px 0 #b8560f, 0 6px 12px rgba(0, 0, 0, 0.5);
}
.tlp-map__close {
	position: absolute; right: 0; top: 50%; translate: 0 -50%;
	width: 36px; height: 36px; padding: 0; border: none; border-radius: 12px; cursor: pointer;
	background: linear-gradient(180deg, #7a6bc4 0%, #4d3f94 100%); color: #fff; font-size: 18px; font-weight: 900;
	box-shadow: 0 3px 0 #2b2160; transition: scale 80ms ease-out; -webkit-tap-highlight-color: transparent;
}
.tlp-map__close:active { scale: 0.9; }
.tlp-map__list {
	display: grid; grid-template-columns: 1fr 1fr; gap: clamp(6px, 1.8vmin, 10px);
	min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; touch-action: pan-y;
}
.tlp-map__list::-webkit-scrollbar { display: none; }
.tlp-map__card {
	display: flex; align-items: center; gap: 10px; min-width: 0; padding: clamp(8px, 2.2vmin, 12px) 12px; box-sizing: border-box;
	border: none; border-radius: 16px; cursor: pointer; text-align: left;
	background: rgba(255, 255, 255, 0.08); color: #fff; font-family: inherit;
	transition: scale 80ms ease-out; -webkit-tap-highlight-color: transparent;
}
.tlp-map__card:active { scale: 0.95; }
.tlp-map__number {
	flex-shrink: 0; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
	background: linear-gradient(180deg, #8dff5e 0%, #36c22a 100%); color: #fff; font-size: 17px; font-weight: 900;
	text-shadow: 0 2px 0 #1d7a14; box-shadow: 0 3px 0 #1d7a14;
}
.tlp-map__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: clamp(14px, 4vmin, 16px); font-weight: 800; }
.tlp-map__mark { flex-shrink: 0; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7dff5a; }
.tlp-map__card--here { background: rgba(255, 207, 74, 0.2); box-shadow: inset 0 0 0 2px #ffcf4a; }
.tlp-map__card--here .tlp-map__mark { color: #ffe066; }
.tlp-map__card--passed .tlp-map__mark { color: #c9b8ff; }
.tlp-map__card--locked { cursor: default; background: rgba(0, 0, 0, 0.25); color: #8c80b8; }
.tlp-map__card--locked:active { scale: none; }
.tlp-map__card--locked .tlp-map__number { background: rgba(255, 255, 255, 0.08); box-shadow: none; text-shadow: none; font-size: 15px; }
.tlp-map__card--locked .tlp-map__mark { color: #8c80b8; }
/* A phone on its side: a wider sheet, the levels in more columns. */
@media (orientation: landscape) and (max-height: 540px) {
	.tlp-map__sheet { width: min(680px, 100%); }
	.tlp-map__list { grid-template-columns: repeat(3, 1fr); }
}
`;
