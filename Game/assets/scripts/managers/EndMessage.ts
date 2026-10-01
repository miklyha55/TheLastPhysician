import { I18n } from "./I18n";
import { IntroScript, IntroText } from "./IntroText";
import { Sfx } from "./audio/Sfx";
import { Sound } from "./audio/Sound";

// The end message, the way ThroughTheDeadCity answers its call after the last level: before the
// final picture, a black screen and a voice, its words typed on the same plate as the intro's,
// skippable the same way. The final screen comes when the voice has said its last — or at once on
// the skip. Black of its own, not the final picture under the voice: this is a thing to listen to,
// and a picture would pull the eye. Should the sound not start — refused, missing, stalled — the
// message quietly counts as over and the final screen shows all the same.

/** The words, one line a phrase, and when each starts in its own recording — measured on the track. */
const SCRIPTS: { [language: string]: IntroScript } = {
	ru: {
		lines: ["Он вырвался из тьмы.", "Подземелье осталось позади,", "а впереди — новый рассвет."],
		times: [0.02, 2.12, 4.26],
		tailOut: 0.07,
	},
	en: {
		lines: ["He broke free from the darkness.", "The dungeon is left behind,", "and ahead — a new dawn."],
		times: [0.02, 2.32, 4.22],
		tailOut: 0.04,
	},
};

/** The channel the voice plays on. */
const CHANNEL = "endMessage";
/** Seconds of the black coming up before the voice starts. */
const FADE_IN = 1;
/** Seconds of the black melting away off the final screen. */
const FADE_OUT = 0.6;
/** Seconds from the start of the speech till the skip button shows. */
const SKIP_AFTER = 0.8;
/** Seconds the voice may take to start: past that it counts as not coming. */
const START_WAIT = 5;
/** Seconds at the most the speech is held for: should the track never say it has ended. */
const MAX_WAIT = 30;

export class EndMessage {
	private static _text = new IntroText();
	private static _veil: HTMLDivElement = null;
	private static _speaking = false;
	private static _onDone: () => void = null;
	private static _onCovered: () => void = null;
	private static _timers: number[] = [];
	private static _listening = false;

	static get speaking(): boolean {
		return EndMessage._speaking;
	}

	/**
	 * The black, the voice and its words; `onCovered` — the black is all over the game (the world
	 * may stop then, out of sight); `onDone` — the final screen, put up under the black before it goes.
	 */
	static play(onDone: () => void, onCovered: () => void = null): void {
		if (EndMessage._speaking) {
			return;
		}
		if (typeof document === "undefined" || !document.body) {
			onCovered && onCovered();
			onDone();
			return;
		}
		EndMessage._listen();
		EndMessage._speaking = true;
		EndMessage._onDone = onDone;
		EndMessage._onCovered = onCovered;
		const veil = EndMessage._build();
		veil.hidden = false;
		// Its clear state worked out before the black is asked for: shown and turned black in the
		// same breath, a browser may skip the transition — the screen went black at one frame.
		void veil.getBoundingClientRect();
		void getComputedStyle(veil).opacity;
		veil.classList.add("tlp-endmsg--on");
		// The music down under the voice, as under the intro's.
		Sfx.duckMusic(true);
		EndMessage._later(FADE_IN, () => {
			EndMessage._covered();
			let started = false;
			Sound.play(Sfx.endMessage, { id: CHANNEL, volume: Sfx.gain(Sfx.endMessage), onEnded: () => EndMessage._finish() });
			// The text follows the track, not a timer of its own.
			EndMessage._text.start(SCRIPTS[I18n.language] || SCRIPTS.en, () => {
				const progress = Sound.progress(CHANNEL);
				progress && progress.time > 0 && (started = true);
				return progress;
			});
			EndMessage._text.armSkip(SKIP_AFTER, I18n.t("skip.keys"), I18n.t("skip.touch"));
			// Safeguards: the voice may never start, or never say it has ended.
			EndMessage._later(START_WAIT, () => started || EndMessage._finish());
			EndMessage._later(MAX_WAIT, () => EndMessage._finish());
		});
	}

	/**
	 * The black and its look made ahead, at the start of the game: made at the moment it is
	 * needed, the page restyles itself in the middle of the fade.
	 */
	static prepare(): void {
		typeof document !== "undefined" && document.body && EndMessage._build();
	}

	/** Skipped: the voice stops, the final screen at once. */
	static skip(): void {
		EndMessage._speaking && EndMessage._finish(true);
	}

	private static _finish(now = false): void {
		if (!EndMessage._speaking) {
			return;
		}
		EndMessage._speaking = false;
		EndMessage._timers.forEach((timer) => clearTimeout(timer));
		EndMessage._timers = [];
		Sound.stop(CHANNEL);
		EndMessage._text.stop(now);
		Sfx.duckMusic(false);
		// Skipped before the black was all up: the world stops all the same.
		EndMessage._covered();
		// The final screen first, under the black, and only then the black goes: or the game
		// itself would flash between them.
		const done = EndMessage._onDone;
		EndMessage._onDone = null;
		done && done();
		const veil = EndMessage._veil;
		veil.classList.remove("tlp-endmsg--on");
		setTimeout(() => !EndMessage._speaking && (veil.hidden = true), FADE_OUT * 1000);
	}

	/** The black is all over the game: told once. */
	private static _covered(): void {
		const covered = EndMessage._onCovered;
		EndMessage._onCovered = null;
		covered && covered();
	}

	private static _later(seconds: number, action: () => void): void {
		EndMessage._timers.push(setTimeout(action, seconds * 1000) as unknown as number);
	}

	/** Escape skips, as the intro; before the engine, which keeps the keys to itself. */
	private static _listen(): void {
		if (EndMessage._listening) {
			return;
		}
		EndMessage._listening = true;
		EndMessage._text.onSkip = () => EndMessage.skip();
		addEventListener("keydown", (event: KeyboardEvent) => event.code === "Escape" && EndMessage.skip(), { capture: true });
	}

	private static _build(): HTMLDivElement {
		if (EndMessage._veil) {
			return EndMessage._veil;
		}
		const style = document.createElement("style");
		style.textContent = STYLE;
		document.head.appendChild(style);
		const veil = document.createElement("div");
		veil.className = "tlp-endmsg";
		veil.hidden = true;
		document.body.appendChild(veil);
		EndMessage._veil = veil;
		return veil;
	}
}

// Under the intro's plate (8000), over the game and its buttons.
const STYLE = `
.tlp-endmsg {
	position: fixed; inset: 0; z-index: 7990; background: #000; pointer-events: all;
	opacity: 0; transition: opacity ${FADE_OUT}s ease;
}
.tlp-endmsg[hidden] { display: none; }
.tlp-endmsg--on { opacity: 1; transition-duration: ${FADE_IN}s; }
`;
