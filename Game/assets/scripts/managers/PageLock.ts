import { EDITOR } from "cc/env";

// The page around the game locked, the way ThroughTheDeadCity locks it: nothing answers a touch,
// a click or a key but the game's own controls and its screens' buttons. No text selected under a
// finger, no system menu on a long press, no tap highlight, no focus ring, no picture dragged
// off, no zoom — by pinch, double tap or Ctrl and the wheel — and no page scrolled or pulled.
//
// One line in the page's markup is not enough: phones stopped listening to `user-scalable=no`
// years ago, on purpose, so that a page cannot forbid zooming small text. For a full-screen game
// with nothing to read that is only a way to break the picture — the canvas stays its size and
// half the screen shows what lay under it — so the gestures themselves are silenced. Single
// touches, the stick, the keys and the buttons are not touched: they need none of this.

const STYLE = `
html, body {
	margin: 0; height: 100%; overflow: hidden;
	touch-action: none; overscroll-behavior: none;
	-webkit-text-size-adjust: 100%; text-size-adjust: 100%;
}
*, *::before, *::after {
	-webkit-user-select: none; user-select: none;
	-webkit-touch-callout: none;
	-webkit-tap-highlight-color: transparent;
}
img { -webkit-user-drag: none; }
*:focus, *:focus-visible { outline: none; }
canvas { touch-action: none; outline: none; }
/* What a finger may move on the page: the lists of the results and of the final screen, on a
   screen too small for them. */
.tlp-results__rows, .tlp-splash__rows { touch-action: pan-y; }
`;

function prevent(event: Event): void {
	event.cancelable && event.preventDefault();
}

export function lockPage(): void {
	if (EDITOR || typeof document === "undefined" || !document.head) {
		return;
	}
	const style = document.createElement("style");
	style.textContent = STYLE;
	document.head.appendChild(style);

	// The viewport: the page its screen's width, never scaled.
	let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
	if (!meta) {
		meta = document.createElement("meta");
		meta.name = "viewport";
		document.head.appendChild(meta);
	}
	meta.content = "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

	// No system menu, no selection, no dragging, anywhere.
	for (const event of ["contextmenu", "selectstart", "dragstart"]) {
		addEventListener(event, prevent, { passive: false });
	}

	// A pinch in Safari: its own events — on iOS a pinch goes past touchmove and cannot be stopped there.
	for (const event of ["gesturestart", "gesturechange", "gestureend"]) {
		addEventListener(event, prevent, { passive: false });
	}

	// A pinch on a trackpad, and Ctrl with the wheel: the desktop's zoom.
	addEventListener("wheel", (event: WheelEvent) => event.ctrlKey && prevent(event), { passive: false });

	// Two fingers on the screen are a zoom or a scroll; the game needs one.
	addEventListener("touchmove", (event: TouchEvent) => event.touches.length > 1 && prevent(event), { passive: false });

	// A double tap: the browser zooms to the text with it. Caught by the time between the taps — by
	// `dblclick` the page has zoomed already.
	let lastTap = 0;
	addEventListener(
		"touchend",
		(event: TouchEvent) => {
			const now = performance.now();
			now - lastTap < 260 && prevent(event);
			lastTap = now;
		},
		{ passive: false },
	);
	addEventListener("dblclick", prevent, { passive: false });

	// A scroll the page has nowhere to go: put back at once — it cannot be cancelled.
	addEventListener("scroll", () => (scrollX !== 0 || scrollY !== 0) && scrollTo(0, 0), { passive: true });
	const inner = window.visualViewport;
	if (inner) {
		const settle = () => (inner.offsetLeft !== 0 || inner.offsetTop !== 0) && scrollTo(0, 0);
		inner.addEventListener("scroll", settle);
		inner.addEventListener("resize", settle);
	}
}
