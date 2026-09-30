import { Sound } from "./audio/Sound";
import { I18n } from "./I18n";
import { onRelease } from "./OnRelease";
import { Progress } from "./Progress";

// Two switches in the top left corner, in the look of the map's button across from them: the
// sounds, and the music. A switch off is struck through in red. What they are set to is kept in
// the platform's cloud with the progress, so a game muted stays muted on the next visit.
//
// They are there when the map's button is — while a level is being played with the player on
// their feet — and go with it while the map is open.

export class SoundToggles {
	private static _root: HTMLDivElement = null;
	private static _sound: HTMLButtonElement = null;
	private static _music: HTMLButtonElement = null;

	/** The switches, set as saved; `visible` — may they be seen now, asked a few times a second. */
	static start(visible: () => boolean): void {
		if (typeof document === "undefined" || !document.body || SoundToggles._root) {
			return;
		}
		Sound.soundOn = Progress.soundOn;
		Sound.musicOn = Progress.musicOn;

		const style = document.createElement("style");
		style.textContent = STYLE;
		document.head.appendChild(style);
		const root = document.createElement("div");
		root.className = "tlp-audio";
		root.hidden = true;
		SoundToggles._sound = SoundToggles._button(SPEAKER, () => (Sound.soundOn = !Sound.soundOn));
		SoundToggles._music = SoundToggles._button(NOTE, () => (Sound.musicOn = !Sound.musicOn));
		root.append(SoundToggles._sound, SoundToggles._music);
		document.body.appendChild(root);
		SoundToggles._root = root;
		SoundToggles._show();

		// Checked a few times a second, as the map's button: the screens that hide them come and go
		// from many places. The map, whose button sits beside them, says so at once (refresh).
		SoundToggles._visible = visible;
		setInterval(() => SoundToggles.refresh(), 200);
	}

	private static _visible: () => boolean = null;

	/** Shown or hidden as they may be now, at once — not at the next check. */
	static refresh(): void {
		SoundToggles._root && SoundToggles._visible && (SoundToggles._root.hidden = !SoundToggles._visible());
	}

	private static _button(icon: string, flip: () => void): HTMLButtonElement {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "tlp-audio__button";
		button.innerHTML = icon + SLASH;
		onRelease(button, () => {
			flip();
			Progress.setAudio(Sound.soundOn, Sound.musicOn);
			SoundToggles._show();
		});
		return button;
	}

	/** The buttons as the switches stand. */
	private static _show(): void {
		const set = (button: HTMLButtonElement, on: boolean, key: string) => {
			button.classList.toggle("tlp-audio__button--off", !on);
			button.setAttribute("aria-pressed", String(on));
			button.setAttribute("aria-label", I18n.t(key));
		};
		set(SoundToggles._sound, Sound.soundOn, "audio.sound");
		set(SoundToggles._music, Sound.musicOn, "audio.music");
	}
}

/** A speaker with its waves. */
const SPEAKER =
	'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.2h3.6L12.4 5v14l-4.8-4.2H4z" fill="#ffe066" stroke="#ffe066" stroke-width="1.6" stroke-linejoin="round"/><path class="tlp-audio__waves" d="M15.6 9a4.2 4.2 0 0 1 0 6M18.2 6.6a7.6 7.6 0 0 1 0 10.8" fill="none" stroke="#ffe066" stroke-width="2.2" stroke-linecap="round"/></svg>';
/** Two notes, joined. */
const NOTE =
	'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 17.5V6.2l10-2.2v11.2" fill="none" stroke="#ffe066" stroke-width="2.2" stroke-linejoin="round"/><ellipse cx="6.6" cy="17.6" rx="2.9" ry="2.3" fill="#ffe066"/><ellipse cx="16.6" cy="15.3" rx="2.9" ry="2.3" fill="#ffe066"/></svg>';
/** The red stroke over a switch that is off. */
const SLASH =
	'<svg class="tlp-audio__slash" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 4.5l15 15" fill="none" stroke="#16102d" stroke-width="5.4" stroke-linecap="round"/><path d="M4.5 4.5l15 15" fill="none" stroke="#ff4d40" stroke-width="3" stroke-linecap="round"/></svg>';

const STYLE = `
.tlp-audio {
	position: fixed; z-index: 9990;
	top: max(12px, env(safe-area-inset-top)); left: max(12px, env(safe-area-inset-left));
	display: flex; gap: 10px;
}
.tlp-audio[hidden] { display: none; }
.tlp-audio__button {
	position: relative; width: 52px; height: 52px; padding: 0; box-sizing: border-box; border-radius: 16px; cursor: pointer;
	display: flex; align-items: center; justify-content: center;
	background: linear-gradient(180deg, #3b2a6e 0%, #241a47 100%);
	border: 3px solid #ffcf4a;
	box-shadow: 0 5px 0 #16102d, 0 10px 18px rgba(0, 0, 0, 0.45), inset 0 2px 0 rgba(255, 255, 255, 0.15);
	transition: scale 80ms ease-out;
	-webkit-tap-highlight-color: transparent;
}
.tlp-audio__button:active { scale: 0.92; }
.tlp-audio__button svg { width: 30px; height: 30px; filter: drop-shadow(0 2px 0 #16102d); }
.tlp-audio__button .tlp-audio__slash { position: absolute; inset: 0; margin: auto; width: 34px; height: 34px; display: none; filter: none; }
/* Off: dimmed, struck through, the speaker without its waves. */
.tlp-audio__button--off { border-color: #8c80b8; background: linear-gradient(180deg, #2e2358 0%, #1c1438 100%); }
.tlp-audio__button--off svg:not(.tlp-audio__slash) { opacity: 0.5; }
.tlp-audio__button--off .tlp-audio__waves { display: none; }
.tlp-audio__button--off .tlp-audio__slash { display: block; }
`;
