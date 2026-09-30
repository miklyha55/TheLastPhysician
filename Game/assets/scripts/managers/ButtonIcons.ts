// The pictures on the cards' buttons in place of their words: white, rounded, bold — the game's
// own chunky look — with the button's dark edge under them as their shadow, as the words had.
// The words stay as the button's label for whoever cannot see it.

export type ButtonIcon = "next" | "replay" | "restart" | "back";

const SVG = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
const LINE = `fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"`;

const ICONS: { [name in ButtonIcon]: string } = {
	// On: a play mark, its corners rounded.
	next: SVG(`<path d="M8 4.9v14.2a1.2 1.2 0 0 0 1.84 1.01l11.1-7.1a1.2 1.2 0 0 0 0-2.02L9.84 3.89A1.2 1.2 0 0 0 8 4.9z" fill="#fff"/>`),
	// Again: an arrow coming round on itself.
	replay: SVG(`<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" ${LINE}/><path d="M4.2 3.6v4.6h4.6" ${LINE}/>`),
	// From the start: back to the bar at the beginning.
	restart: SVG(`<path d="M5.5 4.5v15" ${LINE}/><path d="M19.5 5.3v13.4a1.2 1.2 0 0 1-1.86 1L8.6 13a1.2 1.2 0 0 1 0-2l9.04-5.7a1.2 1.2 0 0 1 1.86 1z" fill="#fff"/>`),
	// Back: to where the player was.
	back: SVG(`<path d="M9.5 15 4 9.5 9.5 4" ${LINE}/><path d="M4.5 9.5h10a5.5 5.5 0 0 1 0 11H11" ${LINE}/>`),
};

/**
 * The mark of an ad, the way ThroughTheDeadCity puts it by its "once more": a play sign in a
 * rounded frame — a video will come first. Beside the button's own picture, a little smaller.
 */
const AD = SVG(
	`<rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M9.9 8.2 16.2 12l-6.3 3.8z" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`,
).replace("<svg ", '<svg class="tlp-iconbutton__ad" ');

/**
 * Puts `icon` on `button` in place of its words, and keeps the words as its label; `ad` — an ad
 * comes before what it does: its mark beside the picture.
 */
export function iconButton(button: HTMLButtonElement, icon: ButtonIcon, text: string, ad = false): void {
	button.classList.add("tlp-iconbutton");
	button.setAttribute("aria-label", text);
	button.title = text;
	button.innerHTML = ICONS[icon] + (ad ? AD : "");
}

/** The look of the pictures, once for every screen. */
export function iconStyle(): void {
	if (typeof document === "undefined" || document.getElementById("tlp-iconbutton-style")) {
		return;
	}
	const style = document.createElement("style");
	style.id = "tlp-iconbutton-style";
	style.textContent = `
/* Over the cards' own display: block, whichever of the styles came first. */
.tlp-results__button.tlp-iconbutton, .tlp-splash__button.tlp-iconbutton { display: flex; align-items: center; justify-content: center; }
.tlp-iconbutton svg {
	display: block; width: clamp(28px, 8vmin, 38px); height: clamp(28px, 8vmin, 38px);
	filter: drop-shadow(0 2px 0 #1d7a14);
}
.tlp-results__button--quiet.tlp-iconbutton svg, .tlp-splash__button--quiet.tlp-iconbutton svg { filter: drop-shadow(0 2px 0 #2b2160); }
.tlp-iconbutton { gap: clamp(8px, 2.4vmin, 12px); }
.tlp-iconbutton svg.tlp-iconbutton__ad { width: clamp(22px, 6.4vmin, 30px); height: clamp(22px, 6.4vmin, 30px); }
`;
	document.head.appendChild(style);
}
