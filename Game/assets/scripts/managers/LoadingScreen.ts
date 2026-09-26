// A loading screen in the page itself, over the game's canvas: it hides the switch from one
// level scene to the next. Dark, with a spinning ring, the name of what is coming and a bar
// that fills as the scene loads. It fades in, and fades out once the new scene is up. Where
// there is no page — a native build — it does nothing and the scene simply changes.
export class LoadingScreen {
	private static _root: HTMLDivElement = null;
	private static _title: HTMLDivElement = null;
	private static _bar: HTMLDivElement = null;
	private static _hideTimer = 0;

	/** Seconds the screen takes to fade in or out. */
	static fadeTime = 0.3;

	private static get _available(): boolean {
		return typeof document !== "undefined" && !!document.body;
	}

	/** Covers the game with `title` on it; `onShown` is called once it covers it fully. */
	static show(title: string, onShown: () => void): void {
		if (!LoadingScreen._available) {
			onShown();
			return;
		}
		LoadingScreen._build();
		clearTimeout(LoadingScreen._hideTimer);
		const root = LoadingScreen._root;
		LoadingScreen._title.textContent = title;
		LoadingScreen.progress(0);
		root.style.display = "flex";
		// Out of the hidden state on the next frame, so the fade plays.
		requestAnimationFrame(() => {
			root.classList.add("tlp-loading--shown");
			setTimeout(onShown, LoadingScreen.fadeTime * 1000);
		});
	}

	/** How much is loaded, 0..1. */
	static progress(share: number): void {
		if (LoadingScreen._bar) {
			LoadingScreen._bar.style.width = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`;
		}
	}

	/** Fades away and uncovers the game. */
	static hide(): void {
		const root = LoadingScreen._root;
		if (!root) {
			return;
		}
		LoadingScreen.progress(1);
		root.classList.remove("tlp-loading--shown");
		clearTimeout(LoadingScreen._hideTimer);
		LoadingScreen._hideTimer = setTimeout(() => {
			root.style.display = "none";
		}, LoadingScreen.fadeTime * 1000) as unknown as number;
	}

	private static _build(): void {
		if (LoadingScreen._root) {
			return;
		}
		const style = document.createElement("style");
		style.textContent = `
.tlp-loading {
	position: fixed; inset: 0; z-index: 10000;
	display: none; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
	background: radial-gradient(ellipse at center, #1d2233 0%, #0b0d14 75%);
	opacity: 0; transition: opacity ${LoadingScreen.fadeTime}s ease;
	pointer-events: all; user-select: none; -webkit-user-select: none;
	font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.tlp-loading--shown { opacity: 1; }
.tlp-loading__ring {
	width: 64px; height: 64px; border-radius: 50%;
	border: 5px solid rgba(255, 255, 255, 0.08);
	border-top-color: #7dff5a; border-right-color: #ff5ab4;
	animation: tlp-spin 0.9s linear infinite;
	box-shadow: 0 0 24px rgba(125, 255, 90, 0.25);
}
.tlp-loading__title {
	color: #e9ecf5; font-size: 22px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
	text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}
.tlp-loading__track {
	width: min(240px, 60vw); height: 6px; border-radius: 3px; overflow: hidden;
	background: rgba(255, 255, 255, 0.1);
}
.tlp-loading__bar {
	width: 0%; height: 100%; border-radius: 3px;
	background: linear-gradient(90deg, #7dff5a, #ff5ab4);
	transition: width 0.15s linear;
}
@keyframes tlp-spin { to { transform: rotate(360deg); } }
`;
		document.head.appendChild(style);
		const root = document.createElement("div");
		root.className = "tlp-loading";
		const ring = document.createElement("div");
		ring.className = "tlp-loading__ring";
		const title = document.createElement("div");
		title.className = "tlp-loading__title";
		const track = document.createElement("div");
		track.className = "tlp-loading__track";
		const bar = document.createElement("div");
		bar.className = "tlp-loading__bar";
		track.appendChild(bar);
		root.append(ring, title, track);
		document.body.appendChild(root);
		LoadingScreen._root = root;
		LoadingScreen._title = title;
		LoadingScreen._bar = bar;
	}
}
