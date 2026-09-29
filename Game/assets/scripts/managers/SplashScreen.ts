import { assetManager, ImageAsset, resources } from "cc";
import { focusGame } from "./FocusGame";
import { ResultsButton, ResultsRow } from "./ResultsScreen";

/** What a splash shows. */
export interface SplashContent {
	/** The picture, a path in the resources bundle: "ui/start". */
	image: string;
	title: string;
	subtitle?: string;
	/** Stats under the title, in a card; none — no card. */
	rows?: ResultsRow[];
	buttons: ResultsButton[];
}

// A full-screen picture in the page itself, over everything: the start of the game with a big
// "play" button, and its end with what the player did over all the levels. The picture fills the
// screen whatever its shape; the title stands over it at the top, the stats and the buttons at
// the bottom, each on a darkening so they read. The picture comes from the resources bundle; until it has loaded
// the screen shows its dark backdrop. Where there is no page — a native build — the first
// button is taken at once.
export class SplashScreen {
	private static _root: HTMLDivElement = null;
	private static _image: HTMLDivElement = null;
	private static _title: HTMLDivElement = null;
	private static _subtitle: HTMLDivElement = null;
	private static _rows: HTMLDivElement = null;
	private static _buttons: HTMLDivElement = null;
	private static _pressed = false;
	private static _hideTimer = 0;
	private static _settleTimer = 0;
	private static _urls: { [path: string]: string } = {};

	/** Seconds the screen takes to fade in or out. */
	static fadeTime = 0.35;

	private static get _available(): boolean {
		return typeof document !== "undefined" && !!document.body;
	}

	/** Is it up? */
	static get shown(): boolean {
		return !!SplashScreen._root && SplashScreen._root.style.display === "flex";
	}

	static show(content: SplashContent): void {
		if (!SplashScreen._available) {
			content.buttons[0] && content.buttons[0].onClick();
			return;
		}
		SplashScreen._build();
		clearTimeout(SplashScreen._hideTimer);
		SplashScreen._title.textContent = content.title;
		SplashScreen._subtitle.textContent = content.subtitle || "";
		SplashScreen._subtitle.style.display = content.subtitle ? "" : "none";
		SplashScreen._fillRows(content.rows || []);
		SplashScreen._fillButtons(content.buttons);
		SplashScreen._wanted = content.image;
		SplashScreen._picture(content.image);
		const root = SplashScreen._root;
		root.style.display = "flex";
		// At once, not in the next animation frame: on a phone that frame can come late, and the
		// screen stood there invisible. The layout forced, so the fade still starts from nothing.
		root.classList.remove("tlp-splash--settled");
		void root.offsetWidth;
		root.classList.add("tlp-splash--shown");
		// Should the browser not run the entrance at all: its end state a moment after.
		clearTimeout(SplashScreen._settleTimer);
		SplashScreen._settleTimer = setTimeout(() => root.classList.add("tlp-splash--settled"), 1500) as unknown as number;
	}

	static hide(): void {
		const root = SplashScreen._root;
		if (!root) {
			return;
		}
		root.classList.remove("tlp-splash--shown");
		clearTimeout(SplashScreen._hideTimer);
		SplashScreen._hideTimer = setTimeout(() => (root.style.display = "none"), SplashScreen.fadeTime * 1000) as unknown as number;
	}

	/** The picture from the resources bundle, once; on the page as a background. */
	private static _picture(path: string): void {
		const image = SplashScreen._image;
		const known = SplashScreen._urls[path];
		image.style.backgroundImage = known ? `url("${known}")` : "";
		if (known) {
			return;
		}
		// Not warmed up: in as soon as it comes, if this screen still wants it.
		SplashScreen.preload([path]).then(() => {
			const url = SplashScreen._urls[path];
			url && SplashScreen._wanted === path && (image.style.backgroundImage = `url("${url}")`);
		});
	}

	private static _loading: { [path: string]: Promise<void> } = {};
	/** The picture the screen up now shows. */
	private static _wanted = "";

	/**
	 * The pictures loaded and decoded ahead of their screens: loaded when a screen came up, the
	 * start picture showed on a phone a moment after the screen. Resolves when all are ready —
	 * or could not be: a missing picture never holds a screen back.
	 */
	static preload(paths: string[]): Promise<void> {
		return Promise.all(paths.map((path) => SplashScreen._load(path))).then(() => undefined);
	}

	/**
	 * One picture, by the browser itself, not through the engine's loader: while the start screen
	 * waits for "play" the game is held still (director paused), and the engine's loading does not
	 * finish then — the picture came only after "play". Its file's address comes from the bundle;
	 * the engine's loader is the fallback where there is none.
	 */
	private static _load(path: string): Promise<void> {
		if (SplashScreen._urls[path]) {
			return Promise.resolve();
		}
		if (!SplashScreen._loading[path]) {
			SplashScreen._loading[path] = SplashScreen._fetch(path).then((url) => {
				url ? (SplashScreen._urls[path] = url) : delete SplashScreen._loading[path];
			});
		}
		return SplashScreen._loading[path];
	}

	private static async _fetch(path: string): Promise<string> {
		const info = resources.getInfoWithPath(path, ImageAsset);
		if (info) {
			for (const ext of [".jpg", ".png", ".webp"]) {
				const url = assetManager.utils.getUrlWithUuid(info.uuid, { isNative: true, nativeExt: ext });
				if (await SplashScreen._decoded(url)) {
					return url;
				}
			}
		}
		// No address to be had: through the engine, as before.
		return new Promise<string>((done) => {
			resources.load(path, ImageAsset, (error, asset) => {
				if (error || !asset) {
					console.warn(`SplashScreen: no picture "${path}"`, error || "");
					done(null);
					return;
				}
				const data = asset.data as unknown as HTMLImageElement;
				done((data && data.src) || asset.nativeUrl);
			});
		});
	}

	/** Loaded and decoded by the browser — so the background paints at once; false when it is not there. */
	private static _decoded(url: string): Promise<boolean> {
		return new Promise<boolean>((done) => {
			const image = new Image();
			image.onload = () => {
				const decoding = typeof image.decode === "function" ? image.decode() : Promise.resolve();
				decoding.then(() => done(true), () => done(true));
			};
			image.onerror = () => done(false);
			image.src = url;
		});
	}

	private static _fillRows(rows: ResultsRow[]): void {
		const list = SplashScreen._rows;
		list.textContent = "";
		list.style.display = rows.length ? "" : "none";
		rows.forEach((row, i) => {
			const line = document.createElement("div");
			line.className = "tlp-splash__row" + (row.minor ? " tlp-splash__row--minor" : "");
			line.style.animationDelay = `${0.35 + i * 0.07}s`;
			const icon = document.createElement("span");
			icon.className = "tlp-splash__icon";
			icon.textContent = row.icon;
			const label = document.createElement("span");
			label.className = "tlp-splash__label";
			label.textContent = row.label;
			const value = document.createElement("span");
			value.className = "tlp-splash__value";
			value.textContent = row.value;
			line.append(icon, label, value);
			list.appendChild(line);
		});
	}

	private static _fillButtons(buttons: ResultsButton[]): void {
		const bar = SplashScreen._buttons;
		bar.textContent = "";
		SplashScreen._pressed = false;
		for (const spec of buttons) {
			const button = document.createElement("button");
			button.className = "tlp-splash__button" + (spec.primary ? "" : " tlp-splash__button--quiet");
			button.textContent = spec.text;
			button.addEventListener("click", () => {
				if (SplashScreen._pressed) {
					return;
				}
				SplashScreen._pressed = true;
				// The keys back to the game before the button is disabled with the focus on it.
				focusGame();
				bar.querySelectorAll("button").forEach((b) => ((b as HTMLButtonElement).disabled = true));
				spec.onClick();
			});
			bar.appendChild(button);
		}
	}

	private static _build(): void {
		if (SplashScreen._root) {
			return;
		}
		const style = document.createElement("style");
		style.textContent = `
.tlp-splash {
	position: fixed; inset: 0; z-index: 10010;
	display: none; flex-direction: column; align-items: center;
	padding: calc(max(20px, env(safe-area-inset-top)) + 7vh) max(16px, env(safe-area-inset-right)) calc(max(20px, env(safe-area-inset-bottom)) + 6vh) max(16px, env(safe-area-inset-left));
	box-sizing: border-box;
	background: #0b0d14; overflow: hidden;
	opacity: 0; transition: opacity ${SplashScreen.fadeTime}s ease;
	pointer-events: all; user-select: none; -webkit-user-select: none;
	font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.tlp-splash--shown { opacity: 1; }
.tlp-splash__image {
	position: absolute; inset: 0; background: center / cover no-repeat;
	animation: tlp-splash-zoom 14s ease-out forwards;
}
.tlp-splash__shade {
	position: absolute; inset: 0;
	background: linear-gradient(180deg, rgba(8,6,20,0.75) 0%, rgba(8,6,20,0) 28%, rgba(0,0,0,0) 45%, rgba(8,6,20,0.55) 68%, rgba(8,6,20,0.9) 100%);
}
.tlp-splash__content {
	position: relative; flex: 1; min-height: 0; width: min(420px, 100%);
	display: flex; flex-direction: column; justify-content: space-between; align-items: center; gap: 12px;
}
.tlp-splash__top, .tlp-splash__bottom { width: 100%; display: flex; flex-direction: column; align-items: center; }
.tlp-splash__top { flex-shrink: 0; }
.tlp-splash__bottom { min-height: 0; }
.tlp-splash__title {
	text-align: center; color: #ffe066; font-size: clamp(28px, min(12vw, 10vh), 60px); line-height: 1.05; font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase;
	text-shadow: 0 4px 0 #b8560f, 0 10px 22px rgba(0, 0, 0, 0.7);
	animation: tlp-splash-pop 0.5s cubic-bezier(0.2, 1.6, 0.4, 1) 0.1s both;
}
.tlp-splash__subtitle {
	text-align: center; color: #e6dcff; font-size: clamp(12px, 3.6vmin, 15px); font-weight: 700; margin-top: 6px;
	letter-spacing: 0.12em; text-transform: uppercase; text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
}
.tlp-splash__rows {
	width: 100%; margin-top: 12px; padding: clamp(6px, 2vmin, 10px); box-sizing: border-box; border-radius: 20px;
	display: flex; flex-direction: column; gap: clamp(3px, 1.2vmin, 6px);
	min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
	background: rgba(36, 26, 71, 0.82); border: 3px solid #ffcf4a;
	box-shadow: 0 8px 0 #16102d, 0 14px 30px rgba(0, 0, 0, 0.55);
}
.tlp-splash__row {
	display: flex; align-items: center; gap: 10px; padding: clamp(5px, 1.8vmin, 8px) 12px; border-radius: 12px; flex-shrink: 0;
	background: rgba(255, 255, 255, 0.08); color: #fff; font-size: clamp(13px, 4vmin, 16px); font-weight: 700;
	animation: tlp-splash-row 0.3s ease-out both;
}
.tlp-splash--settled .tlp-splash__title, .tlp-splash--settled .tlp-splash__row { animation: none; opacity: 1; transform: none; }
.tlp-splash__row--minor { padding: 4px 12px 4px 40px; background: none; color: #bfb2e8; font-size: 13px; font-weight: 600; }
.tlp-splash__icon { width: 22px; text-align: center; font-size: 17px; }
.tlp-splash__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tlp-splash__value { color: #7dff5a; font-size: clamp(15px, 4.6vmin, 19px); white-space: nowrap; font-weight: 900; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.35); }
.tlp-splash__row--minor .tlp-splash__value { color: #ffcf4a; font-size: 14px; }
.tlp-splash__rows::-webkit-scrollbar { display: none; }
.tlp-splash__buttons { width: 100%; display: flex; gap: 10px; margin-top: clamp(12px, 3.5vmin, 20px); flex-shrink: 0; }
.tlp-splash__button {
	flex: 1; min-width: 0; padding: clamp(12px, 3.8vmin, 18px) 6px; border: none; border-radius: 20px; cursor: pointer; white-space: nowrap;
	background: linear-gradient(180deg, #8dff5e 0%, #36c22a 100%);
	color: #fff; font-size: clamp(18px, 6vmin, 26px); font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase;
	text-shadow: 0 2px 0 #1d7a14;
	box-shadow: 0 7px 0 #1d7a14, 0 12px 22px rgba(0, 0, 0, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.5);
	animation: tlp-splash-pulse 1.4s ease-in-out 0.8s infinite;
	-webkit-tap-highlight-color: transparent;
}
.tlp-splash__button:active { transform: translateY(5px); box-shadow: 0 2px 0 #1d7a14, 0 5px 12px rgba(0, 0, 0, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.5); animation: none; }
.tlp-splash__button:disabled { filter: saturate(0.4); animation: none; }
.tlp-splash__button--quiet {
	background: linear-gradient(180deg, #7a6bc4 0%, #4d3f94 100%); text-shadow: 0 2px 0 #2b2160; font-size: 20px;
	box-shadow: 0 7px 0 #2b2160, 0 12px 22px rgba(0, 0, 0, 0.5), inset 0 2px 0 rgba(255, 255, 255, 0.35);
	animation: none;
}
/* A short screen upright: the stats tighter, so the picture shows and nothing scrolls. */
@media (orientation: portrait) and (max-height: 720px) {
	.tlp-splash__rows { gap: 2px; padding: 6px; }
	.tlp-splash__row { padding: 4px 10px; font-size: 13px; }
	.tlp-splash__value { font-size: 15px; }
	.tlp-splash__row--minor { padding: 1px 10px 1px 38px; font-size: 12px; }
}
/* A phone on its side: less air at the edges, a wider block, the stats in two columns. */
@media (orientation: landscape) and (max-height: 540px) {
	.tlp-splash { padding-top: max(14px, env(safe-area-inset-top)); padding-bottom: max(14px, env(safe-area-inset-bottom)); }
	.tlp-splash__content { width: min(680px, 100%); }
	.tlp-splash__rows { display: grid; grid-template-columns: 1fr 1fr; grid-auto-flow: row dense; align-content: start; gap: 3px 6px; padding: 6px; }
	.tlp-splash__row { padding: 4px 10px; font-size: 13px; }
	.tlp-splash__value { font-size: 15px; }
	.tlp-splash__row--minor { padding: 4px 10px; font-size: 12px; }
	.tlp-splash__buttons { width: min(360px, 100%); align-self: center; margin-top: 8px; }
	.tlp-splash__title { font-size: clamp(24px, 9vh, 48px); }
	.tlp-splash__subtitle { margin-top: 2px; }
	.tlp-splash__rows { margin-top: 8px; }
	.tlp-splash__button { padding: 10px 6px; font-size: 18px; }
}
@keyframes tlp-splash-zoom { from { transform: scale(1.08); } to { transform: scale(1); } }
@keyframes tlp-splash-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes tlp-splash-row { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes tlp-splash-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
`;
		document.head.appendChild(style);
		const root = document.createElement("div");
		root.className = "tlp-splash";
		const image = document.createElement("div");
		image.className = "tlp-splash__image";
		const shade = document.createElement("div");
		shade.className = "tlp-splash__shade";
		const content = document.createElement("div");
		content.className = "tlp-splash__content";
		const title = document.createElement("div");
		title.className = "tlp-splash__title";
		const subtitle = document.createElement("div");
		subtitle.className = "tlp-splash__subtitle";
		const rows = document.createElement("div");
		rows.className = "tlp-splash__rows";
		const buttons = document.createElement("div");
		buttons.className = "tlp-splash__buttons";
		// The name at the top, the stats and the button at the bottom.
		const top = document.createElement("div");
		top.className = "tlp-splash__top";
		top.append(title, subtitle);
		const bottom = document.createElement("div");
		bottom.className = "tlp-splash__bottom";
		bottom.append(rows, buttons);
		content.append(top, bottom);
		root.append(image, shade, content);
		document.body.appendChild(root);
		SplashScreen._root = root;
		SplashScreen._image = image;
		SplashScreen._title = title;
		SplashScreen._subtitle = subtitle;
		SplashScreen._rows = rows;
		SplashScreen._buttons = buttons;
	}
}
