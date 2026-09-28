import { game } from "cc";

/**
 * Hands the keyboard back to the game after a button of a page screen (the start picture, the
 * results card) was pressed. The engine hears keys on its canvas only, and the pressed button
 * keeps the focus — worse, it is disabled right after, and a browser sends no keys at all from a
 * disabled element that holds the focus: neither the arrows nor WASD moved the hero, and the
 * controls hint listening on the window did not go, until the canvas was clicked.
 */
export function focusGame(): void {
	if (typeof document === "undefined") {
		return;
	}
	const active = document.activeElement as HTMLElement;
	active && active !== document.body && active.blur && active.blur();
	const canvas = game.canvas as HTMLCanvasElement;
	if (!canvas || !canvas.focus) {
		return;
	}
	// A canvas takes the focus only with a tab index.
	canvas.hasAttribute("tabindex") || canvas.setAttribute("tabindex", "-1");
	canvas.focus({ preventScroll: true });
}
