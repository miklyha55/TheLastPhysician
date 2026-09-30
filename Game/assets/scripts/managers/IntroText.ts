// The intro's words on the screen, the way ThroughTheDeadCity shows its radio message: a line at a
// time at the bottom, typed letter by letter as the voice speaks it, and above it a small button
// to skip. In the page itself over the game's canvas.
//
// The text is led by the sound itself: where it is in a line comes from how much of the track has
// played, not from a timer of its own — a timer would drift at any hitch (the sound let out late,
// the tab folded) and by the end be a paragraph ahead or behind. Lines one at a time: the whole
// speech at once would not fit, and a running tail reads better than a sheet. Each line starts at
// the moment measured in the recording, and is typed over most of its time, the rest a pause.

import { onRelease } from "./OnRelease";

export interface IntroScript {
	/** The lines, in the order spoken. */
	lines: string[];
	/** Seconds into the recording each line starts at — measured on the track, one a line. */
	times: number[];
	/** Seconds of silence at the end of the recording. */
	tailOut: number;
}

/** Seconds the text runs ahead of the sound: read by the eye a moment before it is heard, it does not seem late. */
const ADVANCE = 0.15;
/** How much of its time a line is typed over; the rest of it is the pause before the next. */
const TYPE_SHARE = 0.8;

export class IntroText {
	private _root: HTMLDivElement = null;
	private _line: HTMLParagraphElement = null;
	private _typed: HTMLSpanElement = null;
	private _rest: HTMLSpanElement = null;
	private _skip: HTMLDivElement = null;
	private _skipLabel: HTMLButtonElement = null;
	/** On a phone: a round red cross on the plate's top right corner, in place of the line over the text. */
	private _skipCross: HTMLButtonElement = null;
	private _script: IntroScript = null;
	private _clock: () => { time: number; duration: number } | null = null;
	private _plan: { text: string; from: number; to: number }[] = null;
	private _frame = 0;
	private _shown = "";
	private _width = 0;
	private _skipTimer = 0;
	private _skipFade = 0;

	/** Someone asked for the speech to be cut short: the skip button pressed. */
	onSkip: () => void = null;

	private static get _available(): boolean {
		return typeof document !== "undefined" && !!document.body;
	}

	/** Is there a mouse and a keyboard — or the speech is skipped with the button under a finger. */
	private static get _keyboard(): boolean {
		return typeof matchMedia !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches;
	}

	/**
	 * The text goes, following `clock` — the track's played time and length, null while it has
	 * none yet.
	 */
	start(script: IntroScript, clock: () => { time: number; duration: number } | null): void {
		if (!IntroText._available || !script.lines.length) {
			return;
		}
		this._build();
		this._script = script;
		this._clock = clock;
		this._plan = null;
		this._width = 0;
		this._root.classList.add("tlp-radiotext--on");
		this._reserve();
		cancelAnimationFrame(this._frame);
		this._tick();
	}

	/** The text goes; `now` — on the skip button — with no fade: nothing fades after a press. */
	stop(now = false): void {
		cancelAnimationFrame(this._frame);
		this._frame = 0;
		if (!this._root) {
			return;
		}
		if (now) {
			this._root.style.transition = this._skip.style.transition = "none";
			clearTimeout(this._skipTimer);
			clearTimeout(this._skipFade);
			this._skip.classList.remove("tlp-skip--on");
			this._skip.hidden = true;
			this._skipCross.classList.remove("tlp-skipx--on");
			this._skipCross.hidden = true;
		}
		this._root.classList.remove("tlp-radiotext--on");
		this._typed.textContent = "";
		this._rest.textContent = "";
		this._shown = "";
		this._plan = null;
		this.hideSkip();
		if (now) {
			void this._root.offsetWidth;
			this._root.style.transition = this._skip.style.transition = "";
		}
	}

	/**
	 * The skip button, `after` seconds from now: when skipping starts to work — a button that does
	 * nothing yet is worse than none.
	 */
	armSkip(after: number, keys: string, touch: string): void {
		if (!this._root) {
			return;
		}
		clearTimeout(this._skipTimer);
		this._skipTimer = setTimeout(() => {
			clearTimeout(this._skipFade);
			// Asked again: a keyboard may have come since. With one — a hint of the key over the text;
			// under a finger — a cross in the corner, where a thumb looks for "close".
			if (IntroText._keyboard) {
				this._skipLabel.textContent = keys;
				this._skip.hidden = false;
				requestAnimationFrame(() => this._skip.classList.add("tlp-skip--on"));
				return;
			}
			this._skipCross.setAttribute("aria-label", touch);
			this._skipCross.hidden = false;
			requestAnimationFrame(() => this._skipCross.classList.add("tlp-skipx--on"));
		}, after * 1000) as unknown as number;
	}

	hideSkip(): void {
		clearTimeout(this._skipTimer);
		if (!this._skip || (this._skip.hidden && this._skipCross.hidden)) {
			return;
		}
		this._skip.classList.remove("tlp-skip--on");
		this._skipCross.classList.remove("tlp-skipx--on");
		clearTimeout(this._skipFade);
		this._skipFade = setTimeout(() => {
			this._skip.hidden = true;
			this._skipCross.hidden = true;
		}, 400) as unknown as number;
	}

	/**
	 * Room for the longest line: lines take different numbers of rows, and the block, held to the
	 * bottom, would jump on every change. Measured live — how many rows a line takes depends on
	 * the width of the screen and the font.
	 */
	private _reserve(): void {
		if (!this._script || this._width === innerWidth) {
			return;
		}
		this._width = innerWidth;
		const keep = [this._typed.textContent, this._rest.textContent];
		this._line.style.minHeight = "";
		let tallest = 0;
		for (const text of this._script.lines) {
			this._typed.textContent = text;
			this._rest.textContent = "";
			tallest = Math.max(tallest, this._line.getBoundingClientRect().height);
		}
		this._typed.textContent = keep[0];
		this._rest.textContent = keep[1];
		this._line.style.minHeight = `${Math.ceil(tallest)}px`;
	}

	/** When each line starts and ends: built once the length of the track is known. */
	private _schedule(duration: number): { text: string; from: number; to: number }[] {
		const script = this._script;
		const end = Math.max(0.1, duration - script.tailOut);
		return script.lines.map((text, i) => {
			const from = script.times[i];
			const next = i + 1 < script.times.length ? script.times[i + 1] : end;
			return { text, from, to: from + Math.max(0.1, next - from) * TYPE_SHARE };
		});
	}

	private _tick(): void {
		this._frame = requestAnimationFrame(() => this._tick());
		const clock = this._clock && this._clock();
		if (!clock) {
			return;
		}
		if (!this._plan) {
			if (!isFinite(clock.duration) || clock.duration <= 0) {
				return; // the length not known yet
			}
			this._plan = this._schedule(clock.duration);
		}
		const now = clock.time + ADVANCE;
		let line = this._plan[0];
		for (const l of this._plan) {
			if (now >= l.from) {
				line = l;
			}
		}
		const share = line.to > line.from ? (now - line.from) / (line.to - line.from) : 1;
		const letters = Math.round(Math.min(1, Math.max(0, share)) * line.text.length);
		const text = line.text.slice(0, letters);
		if (text === this._shown) {
			return; // not every frame brings a letter
		}
		this._shown = text;
		this._typed.textContent = text;
		this._rest.textContent = line.text.slice(letters);
	}

	private _build(): void {
		if (this._root) {
			return;
		}
		const style = document.createElement("style");
		style.textContent = STYLE;
		document.head.appendChild(style);

		const root = document.createElement("div");
		root.className = "tlp-radiotext";

		// The skip button: a small line right over the plate, inside the same block — placed on its
		// own it would run into the plate, whose height is its own on every screen.
		const skip = document.createElement("div");
		skip.className = "tlp-skip";
		skip.hidden = true;
		const label = document.createElement("button");
		label.className = "tlp-skip__label";
		label.type = "button";
		// Filled from the start: an empty hidden button held less room than a full one, and grew
		// when shown, pushing the plate down.
		label.textContent = "Esc";
		onRelease(label, () => this.onSkip && this.onSkip());
		skip.appendChild(label);

		// The whole line lies in the element from the start, its untyped tail transparent:
		// otherwise every new letter would re-flow the centred, word-wrapped line, and what is
		// written would twitch sideways and jump at a wrap.
		const line = document.createElement("p");
		line.className = "tlp-radiotext__line";
		const typed = document.createElement("span");
		const rest = document.createElement("span");
		rest.className = "tlp-radiotext__rest";
		line.append(typed, rest);

		// The plate: the line, and on a phone the cross on its corner — a thing to close, where one is.
		const plate = document.createElement("div");
		plate.className = "tlp-radiotext__plate";
		plate.appendChild(line);
		root.append(skip, plate);
		document.body.appendChild(root);

		const cross = document.createElement("button");
		cross.type = "button";
		cross.className = "tlp-skipx";
		cross.hidden = true;
		cross.innerHTML =
			'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/></svg>';
		onRelease(cross, () => this.onSkip && this.onSkip());
		plate.appendChild(cross);
		addEventListener("resize", () => this._reserve());

		this._root = root;
		this._line = line;
		this._typed = typed;
		this._rest = rest;
		this._skip = skip;
		this._skipLabel = label;
		this._skipCross = cross;
	}
}

// The game's own look — the cards' violet and yellow — laid out and moving as ThroughTheDeadCity's
// radio text and skip button are.
const STYLE = `
.tlp-radiotext {
	position: fixed; left: 50%; transform: translateX(-50%);
	bottom: calc(92px + env(safe-area-inset-bottom));
	z-index: 8000; pointer-events: none;
	width: min(80vw, 720px);
	opacity: 0; transition: opacity 400ms ease;
	font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
	user-select: none; -webkit-user-select: none;
}
.tlp-radiotext--on { opacity: 1; }
.tlp-radiotext__line {
	margin: 0; padding: 22px 16px; box-sizing: border-box;
	border-radius: 14px;
	background: rgba(36, 26, 71, 0.82);
	border: 2px solid rgba(255, 207, 74, 0.55);
	box-shadow: 0 4px 0 rgba(22, 16, 45, 0.85), 0 8px 18px rgba(0, 0, 0, 0.35);
	color: #fff4d6; font-size: 15px; line-height: 1.5; font-weight: 700; letter-spacing: 0.01em;
	text-align: center;
	min-height: 1.5em;
}
.tlp-radiotext__rest { color: transparent; }
.tlp-skip { margin: 0 0 6px; text-align: center; pointer-events: none; opacity: 0; transition: opacity 400ms ease; }
.tlp-skip[hidden] { display: block; visibility: hidden; }
.tlp-skip--on { opacity: 1; }
.tlp-skip__label {
	pointer-events: auto; display: inline-block;
	padding: 5px 12px; border-radius: 999px;
	background: rgba(36, 26, 71, 0.82);
	border: 2px solid rgba(255, 207, 74, 0.45);
	color: #ffe066; font: inherit; font-size: 11px; line-height: 1; font-weight: 900;
	letter-spacing: 0.1em; text-transform: uppercase;
	cursor: pointer; -webkit-tap-highlight-color: transparent;
	transition: transform 80ms ease-out;
}
/* The line kept clear of the round cross on the plate's corner: it reaches 20px into the plate. */
.tlp-radiotext__plate { position: relative; }
.tlp-skipx {
	position: absolute; z-index: 1; top: -18px; right: -14px; pointer-events: auto;
	width: 40px; height: 40px; padding: 0; border: 3px solid #fff; border-radius: 50%; cursor: pointer;
	display: flex; align-items: center; justify-content: center;
	background: linear-gradient(180deg, #ff6b5e 0%, #d8231b 100%);
	box-shadow: 0 4px 0 #7a1414, 0 8px 16px rgba(0, 0, 0, 0.45);
	opacity: 0; transition: opacity 400ms ease, scale 80ms ease-out;
	-webkit-tap-highlight-color: transparent;
}
.tlp-skipx[hidden] { display: none; }
.tlp-skipx--on { opacity: 1; }
.tlp-skipx:active { scale: 0.9; }
.tlp-skipx svg { width: 20px; height: 20px; filter: drop-shadow(0 2px 0 #7a1414); }
.tlp-skip__label:hover { background: rgba(59, 42, 110, 0.92); border-color: #ffcf4a; }
.tlp-skip__label:active { transform: scale(0.94); }
@media (max-width: 560px) {
	.tlp-radiotext { bottom: calc(112px + env(safe-area-inset-bottom)); width: min(90vw, 560px); }
	.tlp-radiotext__line { font-size: 13px; padding: 22px 12px; }
}
@media (max-height: 460px) {
	.tlp-radiotext { bottom: calc(22px + env(safe-area-inset-bottom)); width: min(70vw, 520px); }
	.tlp-radiotext__line { font-size: 13px; padding: 22px 12px; }
}
`;
