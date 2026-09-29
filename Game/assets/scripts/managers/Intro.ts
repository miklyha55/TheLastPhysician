import { director } from "cc";
import { ControlsHint } from "./ControlsHint";
import { I18n } from "./I18n";
import { IntroScript, IntroText } from "./IntroText";
import { Sfx } from "./audio/Sfx";
import { Sound } from "./audio/Sound";

// The intro, the way ThroughTheDeadCity's start message goes: the voice the first level starts
// with, its words typed at the bottom of the screen as it speaks, skippable.
//
// It waits for the player's first move. First the player sees how to steer (ControlsHint), and
// only when they move does the voice begin: one and the same move takes the hint away and lets
// the speech go. It speaks in the background — the controls are never taken — with the music
// down under it. Skipped with the button over the text, or Escape. Once a session: dying on the
// first level is common, and hearing the same speech after every restart would be a punishment;
// "from scratch" plays the game as the first time, and the intro with it. Leaving the level mid-
// speech cuts it off. Should the sound not start — refused, missing, stalled — the intro quietly
// counts as over and holds nothing.

/** The words, one line a phrase, and when each starts in its own recording — measured on the track. */
const SCRIPTS: { [language: string]: IntroScript } = {
	ru: {
		lines: [
			"Чумной доктор не должен был спускаться так глубоко.",
			"Но зов отчаяния манил всё ниже, сквозь сырые галереи, пока он не оказался в самом сердце подземелья —",
			"среди сотен больных, чьи стоны сливались в единый, тягучий гул.",
			"Теперь путь только один — наверх.",
			"Сквозь этажи тьмы, сквозь боль и страх, сквозь то, что прячется в тенях.",
			"Ему нужно выбраться. Любой ценой.",
		],
		times: [0.1, 3.26, 10.22, 14.74, 17.08, 22.08],
		tailOut: 0.14,
	},
	en: {
		lines: [
			"The plague doctor wasn’t supposed to go down this deep.",
			"But the call of despair kept drawing him lower, through the damp galleries, until he found himself at the very heart of the dungeon —",
			"among hundreds of the sick, whose moans blended into a single, heavy hum.",
			"Now there’s only one way — up.",
			"Through the floors of darkness, through pain and fear, through whatever lurks in the shadows.",
			"He needs to get out. At any cost.",
		],
		times: [0.04, 3.5, 10.76, 15.42, 17.9, 23.04],
		tailOut: 0.05,
	},
};

/** The channel the voice plays on. */
const CHANNEL = "intro";
/** Seconds from the start of the speech till the skip button shows — when skipping starts to work. */
const SKIP_AFTER = 1.6;
/** Seconds at the most the speech is held for: should the track never say it has ended. */
const MAX_LOCK = 90;
/** What the player's first move is heard as. */
const WAKE = ["pointerdown", "touchstart", "keydown"];

type State = "idle" | "armed" | "speaking" | "done";

export class Intro {
	private static _state: State = "idle";
	private static _played = false;
	private static _text = new IntroText();
	private static _timer = 0;
	private static _listening = false;

	/** Waiting for the first move, or speaking: Escape skips it then. */
	static get locked(): boolean {
		return Intro._state === "armed" || Intro._state === "speaking";
	}

	/**
	 * Set on the level that opens: the first one, not heard yet this session. The controls hint
	 * goes up, and the first move of the player starts the voice.
	 */
	static arm(): void {
		if (Intro._played || Intro._state !== "idle" && Intro._state !== "done") {
			return;
		}
		Intro._listen();
		Intro._state = "armed";
		ControlsHint.show();
		// Touch, mouse and keys alike; caught on the way down — the engine stops the keys at the
		// canvas, and they never rise to the window.
		for (const event of WAKE) addEventListener(event, Intro._start, { once: true, capture: true });
	}

	/** Cut short: the player left the level it plays on. Counted as heard — the player chose to go. */
	static stop(): void {
		if (!Intro.locked) {
			return;
		}
		Intro._played = true;
		Intro._forgetWakeup();
		Sound.stop(CHANNEL);
		Intro._text.stop(true);
		Intro._release();
	}

	/** The game from scratch: the intro plays again when the first level opens. */
	static reset(): void {
		Intro._forgetWakeup();
		Sound.stop(CHANNEL);
		Intro._release();
		Intro._played = false;
		Intro._state = "idle";
	}

	/** Skipped: the voice stops, the text and the button go. */
	static skip(): void {
		if (!Intro.locked) {
			return;
		}
		Intro._played = true;
		Intro._forgetWakeup();
		Sound.stop(CHANNEL);
		Intro._text.stop(true);
		Intro._release();
	}

	/** The voice goes: the player has moved for the first time. */
	private static _start = (): void => {
		if (Intro._state !== "armed") {
			return;
		}
		Intro._forgetWakeup();
		Intro._state = "speaking";
		Intro._played = true;
		// The music down under the voice while it speaks.
		Sfx.duckMusic(true);
		const scene = director.getScene();
		const player = scene && scene.getComponentsInChildren("PlayerAttack")[0];
		Sound.play(Sfx.intro, {
			id: CHANNEL,
			volume: Sfx.gain(Sfx.intro),
			at: player ? player.node : undefined,
			onEnded: () => Intro._release(),
		});
		// The text follows the track, not a timer of its own.
		Intro._text.start(SCRIPTS[I18n.language] || SCRIPTS.en, () => Sound.progress(CHANNEL));
		Intro._text.armSkip(SKIP_AFTER, I18n.t("skip.keys"), I18n.t("skip.touch"));
		// A safeguard: the track may never play to its end and never say so.
		clearTimeout(Intro._timer);
		Intro._timer = setTimeout(() => Intro._release(), MAX_LOCK * 1000) as unknown as number;
	};

	private static _release(): void {
		clearTimeout(Intro._timer);
		Intro._timer = 0;
		const was = Intro._state;
		Intro._text.stop();
		Intro._state = "done";
		was === "speaking" && Sfx.duckMusic(false);
	}

	private static _forgetWakeup(): void {
		for (const event of WAKE) removeEventListener(event, Intro._start, { capture: true });
	}

	/**
	 * Escape skips — waiting or speaking, the way ThroughTheDeadCity has it; on the way down, before
	 * the engine stops the key at the canvas. Listened for before the first move is: an Escape as the
	 * first key skips the intro, it does not start it.
	 */
	private static _listen(): void {
		if (Intro._listening || typeof addEventListener === "undefined") {
			return;
		}
		Intro._listening = true;
		Intro._text.onSkip = () => Intro.skip();
		addEventListener("keydown", (event: KeyboardEvent) => event.code === "Escape" && Intro.locked && Intro.skip(), { capture: true });
	}
}
