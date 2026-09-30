// A page button answering on its release: the finger or the mouse let go over the button it
// went down on. Not the browser's `click` — on a phone that comes late, and a finger that shifted
// a little on the glass loses it altogether. Down on the button, up on it: pressed; up off it, or
// the touch taken over by the system: nothing, as with any button.
//
// A button that takes the place of another under the finger — a card's new content in the same
// spot — is not pressed by the release of the touch that went down on the old one: it never saw
// that touch go down.

export function onRelease(element: HTMLElement, action: () => void): void {
	let pointer = -1;
	// A touch on the button is the button's alone. After a tap a phone sends the page mouse events
	// too, at the same spot — and the button is often gone by then (the cross of the intro, a card
	// hidden on its press), so they land on the game's canvas. The engine turns the mouse into a
	// touch numbered 0, the number a phone gives the first finger — the one on the stick — and the
	// mouse's "up" let that finger go in the engine: the stick went dead while still held.
	element.addEventListener("touchstart", (event: TouchEvent) => event.cancelable && event.preventDefault(), { passive: false });
	element.addEventListener("pointerdown", (event: PointerEvent) => {
		if (event.button !== 0) {
			return;
		}
		pointer = event.pointerId;
		// Its release comes here, wherever the finger has gone. Some browsers refuse a pointer they
		// have already let go of: the button works without the capture all the same.
		try {
			element.setPointerCapture && element.setPointerCapture(pointer);
		} catch {
			// released already — the release is heard on the button itself
		}
	});
	element.addEventListener("pointerup", (event: PointerEvent) => {
		if (event.pointerId !== pointer) {
			return;
		}
		pointer = -1;
		const box = element.getBoundingClientRect();
		const over = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
		over && !(element as HTMLButtonElement).disabled && action();
	});
	element.addEventListener("pointercancel", () => (pointer = -1));
	element.addEventListener("lostpointercapture", () => (pointer = -1));
}
