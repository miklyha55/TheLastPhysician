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

	/** Seconds the screen takes to fade in or out. */
	static fadeTime = 0.25;

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
			button.addEventListener("click", () => {
				if (ResultsScreen._pressed) {
					return;
				}
				ResultsScreen._pressed = true;
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
		root.style.display = "flex";
		// Restart the card's entrance.
		ResultsScreen._card.classList.remove("tlp-results__card--in");
		void ResultsScreen._card.offsetWidth;
		requestAnimationFrame(() => {
			root.classList.add("tlp-results--shown");
			ResultsScreen._card.classList.add("tlp-results__card--in");
		});
	}

	/** Fades away. */
	static hide(): void {
		const root = ResultsScreen._root;
		if (!root) {
			return;
		}
		root.classList.remove("tlp-results--shown");
		clearTimeout(ResultsScreen._hideTimer);
		ResultsScreen._hideTimer = setTimeout(() => (root.style.display = "none"), ResultsScreen.fadeTime * 1000) as unknown as number;
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
}
.tlp-results--shown { opacity: 1; }
.tlp-results__card {
	width: min(360px, 100%); padding: 26px 22px 22px; box-sizing: border-box; border-radius: 26px;
	background: linear-gradient(180deg, #3b2a6e 0%, #241a47 100%);
	border: 3px solid #ffcf4a;
	box-shadow: 0 10px 0 #16102d, 0 18px 40px rgba(0, 0, 0, 0.55), inset 0 2px 0 rgba(255, 255, 255, 0.15);
	transform: scale(0.6); opacity: 0;
}
.tlp-results__card--in { animation: tlp-results-pop 0.45s cubic-bezier(0.2, 1.6, 0.4, 1) forwards; }
.tlp-results__title {
	text-align: center; color: #ffe066; font-size: 28px; font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase;
	text-shadow: 0 3px 0 #b8560f, 0 6px 12px rgba(0, 0, 0, 0.5);
}
.tlp-results__subtitle {
	text-align: center; color: #c9b8ff; font-size: 14px; font-weight: 700; margin: 6px 0 18px;
	letter-spacing: 0.12em; text-transform: uppercase;
}
.tlp-results__rows { display: flex; flex-direction: column; gap: 8px; margin-bottom: 22px; }
.tlp-results__row {
	display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 14px;
	background: rgba(255, 255, 255, 0.08); color: #fff; font-size: 17px; font-weight: 700;
	opacity: 0; transform: translateY(8px); animation: tlp-results-row 0.3s ease-out forwards;
}
.tlp-results__row--minor { padding: 6px 14px 6px 42px; background: none; color: #bfb2e8; font-size: 14px; font-weight: 600; }
.tlp-results__icon { width: 22px; text-align: center; font-size: 18px; }
.tlp-results__row--minor .tlp-results__icon { width: 16px; font-size: 13px; }
.tlp-results__label { flex: 1; }
.tlp-results__value { color: #7dff5a; font-size: 20px; font-weight: 900; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.35); }
.tlp-results__row--minor .tlp-results__value { color: #ffcf4a; font-size: 15px; }
.tlp-results__buttons { display: flex; gap: 10px; }
.tlp-results__button {
	display: block; flex: 1; padding: 16px 0; border: none; border-radius: 18px; cursor: pointer;
	background: linear-gradient(180deg, #8dff5e 0%, #36c22a 100%);
	color: #fff; font-size: 22px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase;
	text-shadow: 0 2px 0 #1d7a14;
	box-shadow: 0 6px 0 #1d7a14, 0 10px 18px rgba(0, 0, 0, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.5);
	animation: tlp-results-pulse 1.4s ease-in-out 0.9s infinite;
	-webkit-tap-highlight-color: transparent;
}
.tlp-results__button:active { transform: translateY(4px); box-shadow: 0 2px 0 #1d7a14, 0 4px 10px rgba(0, 0, 0, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.5); animation: none; }
.tlp-results__button:disabled { filter: saturate(0.4); animation: none; }
.tlp-results__button--quiet {
	background: linear-gradient(180deg, #7a6bc4 0%, #4d3f94 100%); text-shadow: 0 2px 0 #2b2160;
	box-shadow: 0 6px 0 #2b2160, 0 10px 18px rgba(0, 0, 0, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.35);
	animation: none;
}
.tlp-results__button--quiet:active { box-shadow: 0 2px 0 #2b2160, 0 4px 10px rgba(0, 0, 0, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.35); }
.tlp-results__title--lost { color: #ff6b6b; text-shadow: 0 3px 0 #7a1414, 0 6px 12px rgba(0, 0, 0, 0.5); }
@keyframes tlp-results-pop { to { transform: scale(1); opacity: 1; } }
@keyframes tlp-results-row { to { opacity: 1; transform: none; } }
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
