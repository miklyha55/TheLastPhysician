import { focusGame } from "./FocusGame";
import { onRelease } from "./OnRelease";
// The results of a level, in the page itself over the game's canvas: a card that bounces in
// with what the player did on the level — zombies killed of how many, and how, potions thrown and
// picked up, barrels, time, the attempt — and buttons: on to the next level, or, after a death,
// the level again or the game from the start. The loading screen then
// covers it (it sits under the loading screen) and the next level loads. Where there is no page
// — a native build — there is nothing to show and it goes straight on.
export interface ResultsRow {
	icon: string;
	label: string;
	value: string;
	/** A line of its own under the main ones, smaller. */
	minor?: boolean;
}

export interface ResultsButton {
	text: string;
	/** The big green one, or a quieter one beside it. */
	primary?: boolean;
	onClick: () => void;
}

export class ResultsScreen {
	private static _root: HTMLDivElement = null;
	private static _card: HTMLDivElement = null;
	private static _title: HTMLDivElement = null;
	private static _subtitle: HTMLDivElement = null;
	private static _rows: HTMLDivElement = null;
	private static _buttons: HTMLDivElement = null;
	private static _pressed = false;
	private static _hideTimer = 0;
	private static _settleTimer = 0;

	/** Seconds the screen takes to fade in or out. */
	static fadeTime = 0.25;

	/** Is the card up — from its showing till it is told to go. */
	static get shown(): boolean {
		return !!ResultsScreen._root && ResultsScreen._root.classList.contains("tlp-results--shown");
	}

	private static get _available(): boolean {
		return typeof document !== "undefined" && !!document.body;
	}

	/**
	 * Shows `rows` under `title`, with `buttons` below; the first button pressed is the only one
	 * that counts. Without a page the first button is taken at once.
	 */
	static show(title: string, subtitle: string, rows: ResultsRow[], buttons: ResultsButton[], lost = false): void {
		if (!ResultsScreen._available) {
			buttons[0] && buttons[0].onClick();
			return;
		}
		ResultsScreen._build();
		clearTimeout(ResultsScreen._hideTimer);
		ResultsScreen._title.textContent = title;
		ResultsScreen._title.classList.toggle("tlp-results__title--lost", !!lost);
		ResultsScreen._subtitle.textContent = subtitle;
		ResultsScreen._pressed = false;
		const bar = ResultsScreen._buttons;
		bar.textContent = "";
		for (const spec of buttons) {
			const button = document.createElement("button");
			button.className = "tlp-results__button" + (spec.primary ? "" : " tlp-results__button--quiet");
			button.textContent = spec.text;
			onRelease(button, () => {
				if (ResultsScreen._pressed) {
					return;
				}
				ResultsScreen._pressed = true;
				// The keys back to the game before the button is disabled with the focus on it.
				focusGame();
				bar.querySelectorAll("button").forEach((b) => ((b as HTMLButtonElement).disabled = true));
				spec.onClick();
			});
			bar.appendChild(button);
		}
		const list = ResultsScreen._rows;
		list.textContent = "";
		rows.forEach((row, i) => {
			const line = document.createElement("div");
			line.className = "tlp-results__row" + (row.minor ? " tlp-results__row--minor" : "");
			line.style.animationDelay = `${0.25 + i * 0.07}s`;
			const icon = document.createElement("span");
			icon.className = "tlp-results__icon";
			icon.textContent = row.icon;
			const label = document.createElement("span");
			label.className = "tlp-results__label";
			label.textContent = row.label;
			const value = document.createElement("span");
			value.className = "tlp-results__value";
			value.textContent = row.value;
			line.append(icon, label, value);
			list.appendChild(line);
		});
		const root = ResultsScreen._root;
		// Already up — the answer to a button on it (the question of "from scratch", the card back
		// after it): the new content in place, with no entrance; a card bouncing in again reads as
		// the screen twitching.
		if (ResultsScreen.shown) {
			clearTimeout(ResultsScreen._settleTimer);
			root.classList.add("tlp-results--settled");
			return;
		}
		root.style.display = "flex";
		// Restart the card's entrance. Shown at once, not in the next animation frame: on a phone
		// that frame can come late or not at all (the page throttled, back from an ad), and the card
		// stood there invisible — its buttons working, nothing to see. The layout is forced so that
		// the fade still starts from nothing.
		ResultsScreen._card.classList.remove("tlp-results__card--in");
		root.classList.remove("tlp-results--settled");
		void root.offsetWidth;
		root.classList.add("tlp-results--shown");
		ResultsScreen._card.classList.add("tlp-results__card--in");
		// And should the browser not run the entrance at all, it is set in its end state a moment
		// after, when it would have played out anyway: the card and every line in plain sight.
		clearTimeout(ResultsScreen._settleTimer);
		ResultsScreen._settleTimer = setTimeout(() => root.classList.add("tlp-results--settled"), 1500) as unknown as number;
	}

	/** Goes at once: it goes on a button, and nothing fades after a press. */
	static hide(): void {
		const root = ResultsScreen._root;
		if (!root) {
			return;
		}
		clearTimeout(ResultsScreen._hideTimer);
		root.classList.remove("tlp-results--shown");
		root.style.display = "none";
	}

	private static _build(): void {
		if (ResultsScreen._root) {
			return;
		}
		const style = document.createElement("style");
		style.textContent = `
.tlp-results {
	position: fixed; inset: 0; z-index: 9990;
	display: none; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;
	background: radial-gradient(ellipse at center, rgba(40, 18, 70, 0.72) 0%, rgba(8, 6, 20, 0.9) 80%);
	opacity: 0; transition: opacity ${ResultsScreen.fadeTime}s ease;
	pointer-events: all; user-select: none; -webkit-user-select: none;
	font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
	padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
}
.tlp-results--shown { opacity: 1; }
.tlp-results__card {
	width: min(380px, 100%); max-height: 100%; padding: clamp(14px, 4vmin, 26px) clamp(14px, 4vmin, 22px) clamp(14px, 3.5vmin, 22px);
	box-sizing: border-box; border-radius: clamp(18px, 5vmin, 26px);
	display: flex; flex-direction: column;
	background: linear-gradient(180deg, #3b2a6e 0%, #241a47 100%);
	border: 3px solid #ffcf4a;
	box-shadow: 0 10px 0 #16102d, 0 18px 40px rgba(0, 0, 0, 0.55), inset 0 2px 0 rgba(255, 255, 255, 0.15);
}
/* Seen in its own style, not only at the end of an animation: should the animation not run, the
   card is there all the same. The entrance plays from nothing to it. */
.tlp-results__card--in { animation: tlp-results-pop 0.45s cubic-bezier(0.2, 1.6, 0.4, 1) both; }
.tlp-results__title {
	text-align: center; color: #ffe066; font-size: clamp(20px, 7vmin, 28px); line-height: 1.1; font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase;
	text-shadow: 0 3px 0 #b8560f, 0 6px 12px rgba(0, 0, 0, 0.5); flex-shrink: 0;
}
.tlp-results__subtitle {
	text-align: center; color: #c9b8ff; font-size: clamp(11px, 3.4vmin, 14px); font-weight: 700; margin: 6px 0 clamp(10px, 3.5vmin, 18px);
	letter-spacing: 0.12em; text-transform: uppercase; flex-shrink: 0;
}
.tlp-results__rows {
	display: flex; flex-direction: column; gap: clamp(4px, 1.5vmin, 8px); margin-bottom: clamp(12px, 4vmin, 22px);
	min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
}
.tlp-results__rows::-webkit-scrollbar { display: none; }
.tlp-results__row {
	display: flex; align-items: center; gap: 10px; padding: clamp(6px, 2vmin, 10px) 14px; border-radius: 14px;
	background: rgba(255, 255, 255, 0.08); color: #fff; font-size: clamp(14px, 4.2vmin, 17px); font-weight: 700; flex-shrink: 0;
	animation: tlp-results-row 0.3s ease-out both;
}
.tlp-results__row--minor { padding: 6px 14px 6px 42px; background: none; color: #bfb2e8; font-size: 14px; font-weight: 600; }
.tlp-results__icon { width: 22px; text-align: center; font-size: 18px; }
.tlp-results__row--minor .tlp-results__icon { width: 16px; font-size: 13px; }
.tlp-results__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tlp-results__value { color: #7dff5a; font-size: clamp(16px, 5vmin, 20px); white-space: nowrap; font-weight: 900; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.35); }
.tlp-results__row--minor .tlp-results__value { color: #ffcf4a; font-size: 15px; }
.tlp-results__buttons { display: flex; gap: 10px; flex-shrink: 0; }
.tlp-results__button {
	display: block; flex: 1; min-width: 0; padding: clamp(11px, 3.6vmin, 16px) 6px; border: none; border-radius: 18px; cursor: pointer;
	white-space: nowrap;
	background: linear-gradient(180deg, #8dff5e 0%, #36c22a 100%);
	color: #fff; font-size: clamp(15px, 5vmin, 22px); font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase;
	text-shadow: 0 2px 0 #1d7a14;
	box-shadow: 0 6px 0 #1d7a14, 0 10px 18px rgba(0, 0, 0, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.5);
	animation: tlp-results-pulse 1.4s ease-in-out 0.9s infinite;
	-webkit-tap-highlight-color: transparent;
	transition: scale 80ms ease-out;
}
/* A press is only the button giving under the finger: its own scale, apart from the pulse's
   transform, so neither cuts the other short. Nothing else on the screen moves for it. */
.tlp-results__button:active { scale: 0.94; }
.tlp-results__button--quiet {
	background: linear-gradient(180deg, #7a6bc4 0%, #4d3f94 100%); text-shadow: 0 2px 0 #2b2160;
	box-shadow: 0 6px 0 #2b2160, 0 10px 18px rgba(0, 0, 0, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.35);
	animation: none;
}
.tlp-results__title--lost { color: #ff6b6b; text-shadow: 0 3px 0 #7a1414, 0 6px 12px rgba(0, 0, 0, 0.5); }
/* A phone on its side: a wide card, the stats in two columns. */
@media (orientation: landscape) and (max-height: 540px) {
	.tlp-results__card { width: min(620px, 100%); padding: 12px 16px 14px; }
	.tlp-results__title { font-size: 22px; }
	.tlp-results__subtitle { margin: 2px 0 8px; font-size: 11px; }
	.tlp-results__rows { display: grid; grid-template-columns: 1fr 1fr; grid-auto-flow: row dense; align-content: start; gap: 3px 6px; margin-bottom: 10px; }
	.tlp-results__row { padding: 4px 10px; font-size: 13px; }
	.tlp-results__value { font-size: 15px; }
	.tlp-results__button { padding: 10px 6px; font-size: 17px; }
	.tlp-results__buttons { width: min(380px, 100%); align-self: center; }
	/* The small line of how belongs under "killed": the whole width, so it does not stray. */
	.tlp-results__row--minor { grid-column: 1 / -1; padding: 1px 10px 1px 40px; font-size: 12px; }
}
.tlp-results--settled .tlp-results__card, .tlp-results--settled .tlp-results__row { animation: none; opacity: 1; transform: none; }
@keyframes tlp-results-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes tlp-results-row { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes tlp-results-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
`;
		document.head.appendChild(style);
		const root = document.createElement("div");
		root.className = "tlp-results";
		const card = document.createElement("div");
		card.className = "tlp-results__card";
		const title = document.createElement("div");
		title.className = "tlp-results__title";
		const subtitle = document.createElement("div");
		subtitle.className = "tlp-results__subtitle";
		const rows = document.createElement("div");
		rows.className = "tlp-results__rows";
		const buttons = document.createElement("div");
		buttons.className = "tlp-results__buttons";
		card.append(title, subtitle, rows, buttons);
		root.appendChild(card);
		document.body.appendChild(root);
		ResultsScreen._root = root;
		ResultsScreen._card = card;
		ResultsScreen._title = title;
		ResultsScreen._subtitle = subtitle;
		ResultsScreen._rows = rows;
		ResultsScreen._buttons = buttons;
	}
}
