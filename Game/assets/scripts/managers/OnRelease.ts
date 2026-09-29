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
	element.addEventListener("pointerdown", (event: PointerEvent) => {
		if (event.button !== 0) {
			return;
		}
		pointer = event.pointerId;
		// Its release comes here, wherever the finger has gone.
		element.setPointerCapture && element.setPointerCapture(pointer);
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
