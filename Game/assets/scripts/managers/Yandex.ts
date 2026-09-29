import { focusGame } from "./FocusGame";

// Yandex Games: everything the game asks the platform and tells it, in one layer, the way
// ThroughTheDeadCity has it — the rest of the game knows nothing of the platform. The game must
// run the same on the platform, on a server of its own and in the editor's preview, where there
// is no SDK; so every method here either does its work or quietly does nothing, and whoever
// calls it does not care which. Nothing waits in silence: without the platform the promises
// answer at once.

/** Where the SDK lies: on the platform itself, from the root of its domain; never a copy of our own. */
const SCRIPT = "/sdk.js";
/** Seconds to wait for the script: off the platform it is not there, and there is nothing to wait for. */
const WAIT_FOR = 6;
/** Seconds an ad may take at the most: a safeguard, so the game never hangs on one. */
const ADV_TIMEOUT = 45;
/** Seconds for a rewarded video to open at all; none by then — the game goes on. */
const ADV_OPEN_WAIT = 2;

/** How a rewarded video ended: watched, closed before it counted, or never shown at all. */
export type RewardedResult = "rewarded" | "declined" | "none";

export class Yandex {
	/** The SDK, once it is up. */
	private static _sdk: any = null;
	private static _starting: Promise<boolean> = null;
	/** The platform has been told the game has loaded. */
	private static _told = false;
	/** Is gameplay on, as far as the platform knows. */
	private static _playing = false;

	/** The platform asks the game to stop — an ad, a purchase window, another tab. */
	static onPause: () => void = null;
	/** And to go on. */
	static onResume: () => void = null;

	/** Is the platform there. */
	static get ready(): boolean {
		return !!Yandex._sdk;
	}

	/**
	 * Brings the SDK up — once; asked again, the same promise. True when it is up; false off
	 * the platform, or when it did not answer: the game goes on as it is.
	 */
	static start(): Promise<boolean> {
		if (!Yandex._starting) {
			Yandex._starting = Yandex._start();
		}
		return Yandex._starting;
	}

	private static async _start(): Promise<boolean> {
		try {
			if (typeof document === "undefined") {
				return false;
			}
			// Asked for quietly first: a script tag that fails is reported as an error over the game
			// by the engine's preview; off the platform the address is simply not there.
			if (!(await exists(SCRIPT, WAIT_FOR * 1000))) {
				return false;
			}
			await load(SCRIPT, WAIT_FOR * 1000);
			const games = (globalThis as any).YaGames;
			if (!games) {
				return false;
			}
			Yandex._sdk = await games.init();
			Yandex._sdk && Yandex._listen();
			return !!Yandex._sdk;
		} catch {
			return false;
		}
	}

	/**
	 * Pause and resume on the platform's word: it sends them when it shows an ad, opens a
	 * purchase window, or the tab is switched or the window folded. The game must stop then.
	 */
	private static _listen(): void {
		const sdk = Yandex._sdk;
		sdk.on && sdk.on("game_api_pause", () => Yandex.onPause && Yandex.onPause());
		sdk.on &&
			sdk.on("game_api_resume", () => {
				regainFocus();
				Yandex.onResume && Yandex.onResume();
			});
	}

	/** The language of the platform's interface; off it — null, and the browser's stands. */
	static language(): string {
		const sdk = Yandex._sdk;
		return (sdk && sdk.environment && sdk.environment.i18n && sdk.environment.i18n.lang) || null;
	}

	/**
	 * The game has loaded and the player can act — once a session: this is about starting the
	 * game, not every level; a second call the platform would count as another load.
	 */
	static loaded(): void {
		if (Yandex._told) {
			return;
		}
		Yandex._told = true;
		const api = Yandex._sdk && Yandex._sdk.features && Yandex._sdk.features.LoadingAPI;
		api && api.ready && api.ready();
	}

	/**
	 * Gameplay has started: a level opened, a screen closed, an ad ended. Repeats are dropped —
	 * the reasons to stop overlap (death, then an ad, then a loading), and three in a row only
	 * muddle the platform's counts.
	 */
	static play(): void {
		if (Yandex._playing) {
			return;
		}
		Yandex._playing = true;
		const api = Yandex._sdk && Yandex._sdk.features && Yandex._sdk.features.GameplayAPI;
		api && api.start && api.start();
	}

	/** Gameplay has stopped: results, death, loading, an ad, the tab left. */
	static pause(): void {
		if (!Yandex._playing) {
			return;
		}
		Yandex._playing = false;
		const api = Yandex._sdk && Yandex._sdk.features && Yandex._sdk.features.GameplayAPI;
		api && api.stop && api.stop();
	}

	/**
	 * A rewarded video. Three ends, not to be mixed up:
	 * - "rewarded" — watched: the platform sent onRewarded; only then is the reward given;
	 * - "declined" — the video was on screen, and the player closed it before it counted;
	 * - "none" — there was no video: none given, an error, no answer, or no platform. The
	 *   player is not to blame, and must not be locked out by a failed ad.
	 */
	static showRewarded(): Promise<RewardedResult> {
		const adv = Yandex._sdk && Yandex._sdk.adv;
		if (!adv || !adv.showRewardedVideo) {
			return Promise.resolve("none");
		}
		// Gameplay after the video as it was before it: shown from the death card, where all is
		// stopped already, a blind "play" at the end would report gameplay that is not there.
		const wasPlaying = Yandex._playing;
		return new Promise<RewardedResult>((done) => {
			let rewarded = false;
			let opened = false;
			let settled = false;
			// Answered once, at once. onClose comes without onOpen too: no video found, a
			// frequency limit, a failure — then there is nothing to wait for.
			const finish = (closed: boolean) => {
				if (settled) {
					return;
				}
				settled = true;
				clearTimeout(opening);
				clearTimeout(timer);
				done(rewarded ? "rewarded" : opened && closed ? "declined" : "none");
			};
			// Not open within a couple of seconds — the game goes on: the platform sometimes
			// answers a first request slowly and silently, and the player sat before a still screen.
			const opening = setTimeout(() => !opened && finish(false), ADV_OPEN_WAIT * 1000);
			const timer = setTimeout(() => finish(false), ADV_TIMEOUT * 1000);
			Yandex.pause();
			// The callbacks go in `callbacks`: passed at the top level the platform never calls them.
			adv.showRewardedVideo({
				callbacks: {
					onOpen: () => (opened = true),
					onRewarded: () => (rewarded = true),
					onClose: (wasShown: boolean) => {
						opened = opened || wasShown === true;
						finish(true);
					},
					onError: () => finish(false),
				},
			});
		}).finally(() => {
			wasPlaying && Yandex.play();
			regainFocus();
		});
	}

	/**
	 * What was saved for this player — in the platform's cloud, tied to the player whether signed
	 * in or not. Off the platform (a preview, a server of our own) nothing is kept at all: the game
	 * starts from its first level every time. Nothing saved, or no answer — an empty object: the
	 * game starts clean rather than fails.
	 */
	static async loadData(): Promise<{ [key: string]: unknown }> {
		const sdk = Yandex._sdk;
		if (!sdk) {
			return {};
		}
		try {
			Yandex._player = Yandex._player || (sdk.getPlayer ? await sdk.getPlayer({ scopes: false }) : null);
			const data = Yandex._player && Yandex._player.getData ? await Yandex._player.getData() : null;
			return data && typeof data === "object" ? data : {};
		} catch {
			return {};
		}
	}

	/**
	 * Saves `state` whole — the platform is not promised to merge keys with what it has. `now` —
	 * sent at once, not gathered with the next ones: the page is going, or the player wiped it all.
	 */
	static async saveData(state: object, now = false): Promise<void> {
		if (!Yandex._sdk) {
			return; // off the platform nothing is kept
		}
		try {
			Yandex._player && Yandex._player.setData && (await Yandex._player.setData(state, now));
		} catch {
			// no network, or the platform's limit on writes — the game goes on
		}
	}

	/** The player, for their saved data; asked for once. */
	private static _player: any = null;

	/** A full-screen ad; true when it was shown. How often, the platform guards itself. */
	static showFullscreen(): Promise<boolean> {
		const adv = Yandex._sdk && Yandex._sdk.adv;
		if (!adv || !adv.showFullscreenAdv) {
			return Promise.resolve(false);
		}
		const wasPlaying = Yandex._playing;
		return new Promise<boolean>((done) => {
			const timer = setTimeout(() => done(false), ADV_TIMEOUT * 1000);
			const finish = (shown: boolean) => {
				clearTimeout(timer);
				done(!!shown);
			};
			Yandex.pause();
			adv.showFullscreenAdv({
				callbacks: {
					onClose: finish,
					onError: () => finish(false),
				},
			});
		}).finally(() => {
			wasPlaying && Yandex.play();
			regainFocus();
		});
	}
}

/**
 * The keyboard back to the game. On the platform the game lives in someone else's window, and
 * whatever the platform shows over it — an ad, a dialog — takes the focus and never gives it
 * back: from then on no key reaches the game. The window first, then the canvas, which is where
 * the engine hears the keys.
 */
export function regainFocus(): void {
	try {
		typeof window !== "undefined" && window.focus();
	} catch {
		// the browser would not — the focus is where it was
	}
	focusGame();
}

/** Is there a file at `src`: asked without loading it, with a limit. */
async function exists(src: string, wait: number): Promise<boolean> {
	if (typeof fetch === "undefined") {
		return true;
	}
	const timer = new Promise<boolean>((done) => setTimeout(() => done(false), wait));
	const asked = fetch(src, { method: "HEAD", cache: "no-store" })
		.then((answer) => answer.ok && !/text\/html/i.test(answer.headers.get("content-type") || ""))
		.catch(() => false);
	return Promise.race([asked, timer]);
}

/** Adds a script and waits for it, with a limit: off the platform the address is not there. */
function load(src: string, wait: number): Promise<void> {
	return new Promise<void>((done, fail) => {
		const tag = document.createElement("script");
		tag.src = src;
		tag.async = true;
		const timer = setTimeout(() => fail(new Error("the platform did not answer")), wait);
		const settle = (ok: boolean) => {
			clearTimeout(timer);
			ok ? done() : fail(new Error("the platform's script did not load"));
		};
		tag.addEventListener("load", () => settle(true), { once: true });
		tag.addEventListener("error", () => settle(false), { once: true });
		document.head.appendChild(tag);
	});
}
