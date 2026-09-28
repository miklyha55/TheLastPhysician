// A hint on the controls, in the page itself over the game's canvas, the way ThroughTheDeadCity
// gives it: a card at the bottom of the screen, once, as the first level starts. It shows what
// moves the hero on this machine — the keys W A S D where there are a keyboard and a mouse, a
// stick under a finger on a touch screen, told apart by what the window is pointed at with, not
// by its width (a laptop with a touch screen breaks any guess by size) — and what the hero does
// on his own: stopping, he throws a potion at the zombie himself.
//
// It rises from below and fades away rather than vanishing (vanishing reads as a glitch). It
// goes with the player's first move — that first touch of the stick is the sign it is no longer
// needed — or by itself when only looked at: it must not hang over a fight. It listens for that
// move only after `armAfter`: it comes up with the tap on "play", and a finger leaves the screen
// a moment later, so it could otherwise come and go in one and the same tap. Taps go past it into
// the game — it catches none. Once a session: on a restart of the level it would come back again
// and again. Where there is no page — a native build — there is nothing to show.
export class ControlsHint {
	/** Seconds before it starts listening for the player's first move. */
	static armAfter = 0.45;
	/** Seconds it stays when the player does nothing. */
	static holdFor = 9;
	/** Seconds it takes to fade away; the styles' transition lasts as long. */
	static fadeFor = 0.6;

	static title = "Веди героя";
	static note = "Остановись — и он сам метнёт склянку в зомби";
	static tailKeys = "нажми любую клавишу";
	static tailTouch = "коснись экрана";

	private static _root: HTMLDivElement = null;
	private static _keys: HTMLDivElement = null;
	private static _stick: HTMLDivElement = null;
	private static _tail: HTMLParagraphElement = null;
	private static _shown = false;
	private static _done = false;
	private static _timer = 0;
	private static _fade = 0;

	private static get _available(): boolean {
		return typeof document !== "undefined" && !!document.body;
	}

	/** Is there a mouse and a keyboard — or a touch screen. */
	static get keyboard(): boolean {
		return typeof matchMedia !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches;
	}

	/** Shown once a session. */
	static show(): void {
		if (ControlsHint._done || ControlsHint._shown || !ControlsHint._available) {
			return;
		}
		ControlsHint._build();
		// What they play with is asked at the very moment: the window may have changed.
		const byKeys = ControlsHint.keyboard;
		ControlsHint._keys.hidden = !byKeys;
		ControlsHint._stick.hidden = byKeys;
		ControlsHint._tail.textContent = byKeys ? ControlsHint.tailKeys : ControlsHint.tailTouch;

		ControlsHint._shown = true;
		const root = ControlsHint._root;
		root.hidden = false;
		// A frame for the page to notice it is there: without it the fade has nothing to start from.
		requestAnimationFrame(() => root.classList.add("tlp-hint--on"));

		ControlsHint._timer = setTimeout(() => {
			// On the way down, before the canvas: the engine stops the keys there, and they never rise to the window.
			for (const event of EVENTS) addEventListener(event, ControlsHint._close, { once: true, capture: true });
			ControlsHint._timer = setTimeout(ControlsHint._close, ControlsHint.holdFor * 1000) as unknown as number;
		}, ControlsHint.armAfter * 1000) as unknown as number;
	}

	/** Away at once and for good. */
	static hide(): void {
		clearTimeout(ControlsHint._timer);
		clearTimeout(ControlsHint._fade);
		for (const event of EVENTS) removeEventListener(event, ControlsHint._close, { capture: true });
		ControlsHint._done = true;
		if (ControlsHint._root) {
			ControlsHint._root.classList.remove("tlp-hint--on");
			ControlsHint._root.hidden = true;
		}
	}

	private static _close = (): void => {
		if (!ControlsHint._shown || ControlsHint._done) {
			return;
		}
		ControlsHint._done = true;
		clearTimeout(ControlsHint._timer);
		for (const event of EVENTS) removeEventListener(event, ControlsHint._close, { capture: true });
		// Fades first, and only then leaves the page: taken away at once it would blink.
		const root = ControlsHint._root;
		root.classList.remove("tlp-hint--on");
		ControlsHint._fade = setTimeout(() => (root.hidden = true), ControlsHint.fadeFor * 1000) as unknown as number;
	};

	private static _build(): void {
		if (ControlsHint._root) {
			return;
		}
		const style = document.createElement("style");
		style.textContent = STYLE.replace(/\$FADE/g, `${ControlsHint.fadeFor}s`);
		document.head.appendChild(style);

		const root = document.createElement("div");
		root.className = "tlp-hint";
		root.hidden = true;
		const card = document.createElement("div");
		card.className = "tlp-hint__card";

		// The keys: W on top, A S D under it — as they lie under the hand.
		const keys = document.createElement("div");
		keys.className = "tlp-hint__keys";
		const top = document.createElement("div");
		top.className = "tlp-hint__row";
		top.appendChild(ControlsHint._key("W"));
		const bottom = document.createElement("div");
		bottom.className = "tlp-hint__row";
		bottom.append(ControlsHint._key("A"), ControlsHint._key("S"), ControlsHint._key("D"));
		keys.append(top, bottom);

		// The stick: a ring with its knob pushed aside — as a finger holds it.
		const stick = document.createElement("div");
		stick.className = "tlp-hint__stick";
		const base = document.createElement("span");
		base.className = "tlp-hint__base";
		const knob = document.createElement("span");
		knob.className = "tlp-hint__knob";
		base.appendChild(knob);
		stick.appendChild(base);

		const title = document.createElement("p");
		title.className = "tlp-hint__title";
		title.textContent = ControlsHint.title;
		const note = document.createElement("p");
		note.className = "tlp-hint__note";
		note.textContent = ControlsHint.note;
		const tail = document.createElement("p");
		tail.className = "tlp-hint__tail";

		card.append(keys, stick, title, note, tail);
		root.appendChild(card);
		document.body.appendChild(root);
		ControlsHint._root = root;
		ControlsHint._keys = keys;
		ControlsHint._stick = stick;
		ControlsHint._tail = tail;
	}

	private static _key(letter: string): HTMLSpanElement {
		const cap = document.createElement("span");
		cap.className = "tlp-hint__key";
		cap.textContent = letter;
		return cap;
	}
}

const EVENTS = ["pointerdown", "touchstart", "keydown"];

// The game's own look — the results card's: violet glass, a yellow rim, a deep shadow under it,
// yellow letters with an orange edge — laid out and moving as ThroughTheDeadCity's hint does.
const STYLE = `
.tlp-hint {
	position: fixed; left: 0; right: 0; bottom: 0; z-index: 9000;
	display: flex; justify-content: center;
	padding: 0 16px calc(18px + env(safe-area-inset-bottom));
	pointer-events: none; user-select: none; -webkit-user-select: none;
	font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
	opacity: 0; transform: translateY(14px) scale(0.92);
	transition: opacity $FADE ease, transform $FADE cubic-bezier(0.2, 1.6, 0.4, 1);
}
.tlp-hint[hidden] { display: none; }
.tlp-hint--on { opacity: 1; transform: translateY(0) scale(1); }
.tlp-hint__card {
	display: flex; flex-direction: column; align-items: center; gap: 8px;
	padding: 14px 22px 11px; text-align: center;
	border-radius: 20px;
	background: linear-gradient(180deg, rgba(59, 42, 110, 0.94) 0%, rgba(36, 26, 71, 0.94) 100%);
	border: 3px solid #ffcf4a;
	box-shadow: 0 6px 0 #16102d, 0 12px 28px rgba(0, 0, 0, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.15);
}
.tlp-hint__card p { margin: 0; }
.tlp-hint__keys { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.tlp-hint__keys[hidden], .tlp-hint__stick[hidden] { display: none; }
.tlp-hint__row { display: flex; gap: 5px; }
.tlp-hint__key {
	display: flex; align-items: center; justify-content: center;
	width: 34px; height: 34px; box-sizing: border-box;
	border-radius: 9px;
	background: linear-gradient(180deg, #ffe680 0%, #ffc21a 100%);
	box-shadow: 0 4px 0 #b8560f, inset 0 2px 0 rgba(255, 255, 255, 0.55);
	color: #3b2a6e; font-size: 15px; font-weight: 900; line-height: 1;
	animation: tlp-hint-press 3200ms ease-in-out infinite;
}
.tlp-hint__row:last-child .tlp-hint__key:nth-child(1) { animation-delay: 800ms; }
.tlp-hint__row:last-child .tlp-hint__key:nth-child(2) { animation-delay: 1600ms; }
.tlp-hint__row:last-child .tlp-hint__key:nth-child(3) { animation-delay: 2400ms; }
@keyframes tlp-hint-press {
	0%, 62%, 100% { transform: translateY(0); box-shadow: 0 4px 0 #b8560f, inset 0 2px 0 rgba(255, 255, 255, 0.55); }
	70% { transform: translateY(3px); box-shadow: 0 1px 0 #b8560f, inset 0 2px 0 rgba(255, 255, 255, 0.35); }
}
.tlp-hint__stick { display: flex; justify-content: center; }
.tlp-hint__base {
	position: relative; width: 58px; height: 58px; box-sizing: border-box;
	border-radius: 50%;
	border: 3px solid rgba(255, 207, 74, 0.75);
	background: radial-gradient(circle at 50% 50%, rgba(255, 224, 102, 0.18), rgba(22, 16, 45, 0.35));
	box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.35);
}
.tlp-hint__knob {
	position: absolute; left: 50%; top: 50%;
	width: 24px; height: 24px; margin: -12px 0 0 -12px;
	border-radius: 50%;
	background: linear-gradient(180deg, #ffe680 0%, #ffc21a 100%);
	box-shadow: 0 3px 0 #b8560f, 0 0 12px rgba(255, 207, 74, 0.6);
	animation: tlp-hint-knob 3600ms ease-in-out infinite;
	/* The knob's throw in variables: the ring is smaller on a phone, and the throw shrinks with it. */
	--throw-up: -12px; --throw-side: 11px; --throw-down: 5px;
}
@keyframes tlp-hint-knob {
	0% { transform: translate(0, 0); }
	20% { transform: translate(0, var(--throw-up)); }
	45% { transform: translate(var(--throw-side), var(--throw-down)); }
	70% { transform: translate(calc(var(--throw-side) * -1), var(--throw-down)); }
	100% { transform: translate(0, 0); }
}
.tlp-hint__title {
	margin-top: 2px !important;
	color: #ffe066; font-size: 15px; line-height: 1.15; font-weight: 900; letter-spacing: 0.03em; text-transform: uppercase;
	text-shadow: 0 2px 0 #b8560f, 0 4px 8px rgba(0, 0, 0, 0.45);
}
.tlp-hint__note { color: #e9ddff; font-size: 12px; line-height: 1.35; font-weight: 700; }
.tlp-hint__tail { margin-top: 2px !important; color: #b9a6e8; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
@media (prefers-reduced-motion: reduce) {
	.tlp-hint__key, .tlp-hint__knob { animation: none; }
	.tlp-hint { transition: opacity $FADE ease; transform: none; }
}
/* On a phone smaller still: the screen is narrow, and it stands over the game. */
@media (max-width: 560px) {
	.tlp-hint__card { gap: 6px; padding: 11px 18px 9px; border-radius: 18px; }
	.tlp-hint__key { width: 30px; height: 30px; font-size: 13px; }
	.tlp-hint__base { width: 50px; height: 50px; }
	.tlp-hint__knob { width: 21px; height: 21px; margin: -10.5px 0 0 -10.5px; --throw-up: -10px; --throw-side: 9px; --throw-down: 4px; }
	.tlp-hint__title { font-size: 13px; }
	.tlp-hint__note { font-size: 11px; }
	.tlp-hint__tail { font-size: 9px; }
}
/* Lying down the screen is low: smaller than upright, and closer to the edge. */
@media (max-height: 480px) and (orientation: landscape) {
	.tlp-hint { padding: 0 16px calc(10px + env(safe-area-inset-bottom)); }
	.tlp-hint__card { gap: 5px; padding: 9px 16px 7px; }
	.tlp-hint__key { width: 26px; height: 26px; font-size: 12px; }
	.tlp-hint__base { width: 44px; height: 44px; }
	.tlp-hint__knob { width: 18px; height: 18px; margin: -9px 0 0 -9px; --throw-up: -9px; --throw-side: 8px; --throw-down: 3px; }
	.tlp-hint__title { font-size: 12px; }
	.tlp-hint__note { font-size: 10px; }
	.tlp-hint__tail { font-size: 9px; }
}
`;
