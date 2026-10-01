import { assetManager, Director, director } from "cc";
import { EDITOR } from "cc/env";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";
import { LevelMap, LevelMapEntry } from "./LevelMap";
import { LevelStats } from "./LevelStats";
import { EndMessage } from "./EndMessage";
import { I18n } from "./I18n";
import { Intro } from "./Intro";
import { LoadingScreen } from "./LoadingScreen";
import { lockPage } from "./PageLock";
import { Prewarm } from "./Prewarm";
import { Progress } from "./Progress";
import { ResultsScreen, ResultsRow } from "./ResultsScreen";
import { SoundToggles } from "./SoundToggles";
import { SplashScreen } from "./SplashScreen";
import { Sfx } from "./audio/Sfx";
import { Sound } from "./audio/Sound";
import { Yandex } from "./Yandex";

/** One thing on the stack on the player's back: a potion, or a key of a colour. */
export interface StackItem {
	key: boolean;
	color: number;
	/** A potion's kind (PotionKind): plain, bomb or drone; none — plain. */
	kind?: number;
}

// What lives across the levels, and how the game goes from one to the next. Every level is a
// scene of its own, Level_1 … Level_N; they come in the order of their numbers. Leaving a level through its gate
// takes what the player carries — the stack on the back, potions and keys, bottom to top —
// into the next one, where it is laid back on the stack as it was. The player who dies plays
// the level again from its start, with what they came in with. Between two levels the results
// of the one just left are shown (ResultsScreen) — what the player did on it (LevelStats) — and
// the game waits there, paused, for the player to go on. The switch of scenes is hidden behind
// the loading screen, its bar filling as the next scene loads.
export class GameState {
	private static _levels: string[] = null;

	/**
	 * The level scenes, in the order they are played: every scene called Level_<number> in the
	 * game, by that number — Level_1 … Level_N, however many there are. A new level is just a
	 * new scene named so.
	 */
	static get levels(): string[] {
		if (GameState._levels && GameState._levels.length) {
			return GameState._levels;
		}
		const found: { name: string; index: number }[] = [];
		const bundle = assetManager.main;
		const names: string[] = [];
		// The bundle's scenes, keyed by their paths (a Cache: walked with forEach).
		bundle && bundle.config.scenes.forEach((info, key) => names.push(key));
		for (const key of names) {
			const name = key.split("/").pop().replace(/\.scene$/, "");
			const match = /^Level_(\d+)$/.exec(name);
			match && found.push({ name, index: Number(match[1]) });
		}
		found.sort((a, b) => a.index - b.index);
		GameState._levels = found.map((level) => level.name);
		return GameState._levels;
	}

	private static _level = -1;
	/** What the player brings into the level being loaded; null — the level's own start. */
	private static _carried: StackItem[] = null;
	/** What the player came into the current level with, for playing it again. */
	private static _entry: StackItem[] = null;
	private static _loading = false;
	/** Which try at the current level this is: 1, and one more after every death. */
	private static _attempt = 1;
	/** The game has been started with the start screen's button — or it is up now. */
	private static _started = false;
	/** The start screen's "play" has been pressed: the game is being played, not waiting at its door. */
	private static _begun = false;
	/** What the player did over all the levels done so far in this run of the game. */
	private static _totals = GameState._freshTotals();

	private static _freshTotals() {
		return { levels: 0, zombies: 0, killed: 0, byTraps: 0, byBarrels: 0, thrown: 0, collected: 0, barrels: 0, seconds: 0, deaths: 0, stars: 0 };
	}

	private static _platform: Promise<void> = null;
	/** Stopped by the platform — an ad, another tab — and whether that stopped the world too. */
	private static _hostPaused = false;
	private static _hostHeldWorld = false;
	private static _volumeBefore = 1;

	/**
	 * The platform brought up and the game's language set — once, before the first screen:
	 * part of the texts is read the moment a screen is made. Started as soon as the scripts are,
	 * so that it is up by the time the first level is; off the platform it answers at once.
	 */
	static platform(): Promise<void> {
		if (!GameState._platform) {
			// The editor loads the game's scripts too: no platform there, and its page is not ours to listen to.
			if (EDITOR) {
				return (GameState._platform = Promise.resolve());
			}
			GameState._platform = Yandex.start()
				.then(() => {
					I18n.apply(Yandex.language() || (typeof navigator !== "undefined" ? navigator.language : ""));
					GameState._listenPlatform();
					// What the player had got to, from the platform's cloud: before the start screen,
					// whose "play" goes on from there.
					return Progress.load();
				})
				.then(() => {
					Progress.totals && (GameState._totals = { ...GameState._freshTotals(), ...Progress.totals });
					GameState._setUpMap();
					SoundToggles.start(() => !LevelMap.shown && LevelMap.canOpen());
					EndMessage.prepare();
				});
		}
		return GameState._platform;
	}

	/**
	 * Where everything the platform's pause must stop meets. Its reasons are several — an ad,
	 * a purchase window, the tab left — and they come as one event: the world stops (unless it
	 * already stood, under a card), the sound goes quiet (an ad plays in the same, visible tab),
	 * and the platform's own gameplay mark stops. Its "go on" gives back what its pause took, and
	 * gameplay only where there is a game to go on with — not under a card or the start screen.
	 */
	private static _listenPlatform(): void {
		Yandex.onPause = () => {
			if (GameState._hostPaused) {
				return;
			}
			GameState._hostPaused = true;
			GameState._hostHeldWorld = !director.isPaused();
			GameState._hostHeldWorld && director.pause();
			GameState._volumeBefore = Sound.volume;
			Sound.volume = 0;
			Yandex.pause();
		};
		Yandex.onResume = () => {
			if (!GameState._hostPaused) {
				return;
			}
			GameState._hostPaused = false;
			GameState._hostHeldWorld && director.resume();
			GameState._hostHeldWorld = false;
			Sound.volume = GameState._volumeBefore;
			GameState._running() && Yandex.play();
		};
		// A level uncovered is a level to play — and the first one, opened again from scratch, has its intro.
		LoadingScreen.onHidden = () => {
			GameState._running() && Yandex.play();
			GameState._begun && GameState._level === 0 && !SplashScreen.shown && Intro.arm();
		};
		// The tab out of sight: gameplay stops — off the platform no event says so, and the order of
		// the platform's own and this one is promised by nobody; the repeats Yandex drops.
		typeof document !== "undefined" &&
			document.addEventListener("visibilitychange", () => (document.hidden ? Yandex.pause() : GameState._running() && Yandex.play()));
	}

	/** The level map stopped the world, and gives it back on closing. */
	private static _mapHeld = false;

	/**
	 * The level map (LevelMap): its levels and their best stars from the saved progress, open while
	 * a level is being played with the player on their feet; while it is up the world stands, and a
	 * level picked on it is loaded with the stack the player last came into it with.
	 */
	private static _setUpMap(): void {
		LevelMap.entries = () => {
			const reached = Math.min(Progress.reached, GameState.levels.length);
			return GameState.levels.map(
				(name, index): LevelMapEntry => ({
					index,
					here: index === GameState._level,
					passed: index < reached - 1 || Progress.stars(index) > 0,
					locked: index >= reached,
					stars: Progress.stars(index),
				}),
			);
		};
		LevelMap.canOpen = () => GameState._begun && GameState._running() && !Intro.locked && GameState._playerUp();
		LevelMap.onToggle = (open) => {
			if (open) {
				GameState._mapHeld = !director.isPaused();
				GameState._mapHeld && director.pause();
				Yandex.pause();
			} else {
				GameState._mapHeld && director.resume();
				GameState._mapHeld = false;
				GameState._running() && Yandex.play();
			}
			// The sound switches go and come back with the map's button, at once.
			SoundToggles.refresh();
		};
		LevelMap.onPick = (index) => {
			if (GameState._loading || index < 0 || index >= GameState.levels.length) {
				return;
			}
			GameState._attempt = 1;
			GameState._load(GameState.levels[index], Progress.entry(index));
		};
		LevelMap.start();
	}

	/** Is the player of this level alive — found by name: the player's scripts reach back here. */
	private static _playerUp(): boolean {
		const scene = director.getScene();
		if (!scene) {
			return false;
		}
		if (GameState._playerScene !== scene) {
			GameState._playerScene = scene;
			GameState._player = scene.getComponentInChildren("PlayerAttack") as unknown as { isDead: boolean; isValid: boolean };
		}
		const player = GameState._player;
		return !!player && player.isValid && !player.isDead;
	}

	private static _playerScene: unknown = null;
	private static _player: { isDead: boolean; isValid: boolean } = null;

	/** Is the world going now, with the player in it: no card, no start screen, no loading, no pause. */
	private static _running(): boolean {
		return (
			!GameState._loading &&
			!GameState._hostPaused &&
			!SplashScreen.shown &&
			!ResultsScreen.shown &&
			!director.isPaused() &&
			!(typeof document !== "undefined" && document.hidden)
		);
	}

	/** Seconds the start screen waits for its picture at the most: a slow network does not hold the game. */
	static pictureWait = 4;

	/** What the loading screen calls the level being played. */
	static get title(): string {
		return GameState._level >= 0 ? I18n.t("level.title", GameState._level + 1) : "";
	}

	/** Index of the level being played in `levels`, or -1 in a scene that is not one of them. */
	static get level(): number {
		return GameState._level;
	}

	/**
	 * A level has started. Returns what the player carries into it, to lay on the stack, or
	 * null when they bring nothing from before — the first level, or a level started on its
	 * own — and the level's own start applies.
	 */
	static enter(): StackItem[] {
		GameState._level = GameState._find();
		GameState._loading = false;
		const carried = GameState._carried;
		GameState._carried = null;
		GameState._entry = carried ? carried.slice() : null;
		// Where the player is, with what they came in with, into the cloud — every level but the one the
		// game opens on, which is only its door: the start screen's "play" goes on from the saved one.
		GameState._started && Progress.enter(GameState._level, carried);
		// The very first level of a run: the start screen over it, with the button to play.
		if (!GameState._started) {
			GameState._started = true;
			// The platform first: its language goes on the very first screen (off it this is at once).
			// And the start picture ready, so it comes up with its screen, not after it — not waited
			// for longer than `pictureWait`. The final one loads meanwhile, for the end of the game.
			const picture = Promise.race([SplashScreen.preload(["ui/start"]), new Promise<void>((done) => setTimeout(done, GameState.pictureWait * 1000))]);
			SplashScreen.preload(["ui/final"]);
			Promise.all([GameState.platform(), picture]).then(() => GameState._showStart());
		}
		return carried;
	}

	/**
	 * The start picture with "play". The level warms up under it (Prewarm); once that is done
	 * and the button still not pressed, the game is held still until it is.
	 */
	private static _showStart(): void {
		let held = false;
		const watch = setInterval(() => {
			if (!SplashScreen.shown) {
				clearInterval(watch);
				return;
			}
			if (!held && !Prewarm.active) {
				held = true;
				director.pause();
				// Loaded, and the player can act: the platform measures its loading to this moment.
				Yandex.loaded();
			}
		}, 100);
		SplashScreen.show({
			image: "ui/start",
			title: "The Last Physician",
			subtitle: I18n.t("start.subtitle"),
			buttons: [
				{
					text: I18n.t("start.play"),
					primary: true,
					onClick: () => {
						clearInterval(watch);
						held && director.resume();
						// Saved further on: the game goes on there, with what the player took into it —
						// the start screen gone under the loading one.
						// Saved on a level the game no longer has (there were more once): the last one.
						const saved = Math.min(Progress.level, GameState.levels.length - 1);
						if (saved > 0 && saved !== GameState._level) {
							Yandex.loaded();
							GameState._begun = true;
							Sfx.playMusic();
							GameState._load(GameState.levels[saved], Progress.entry(saved), () => SplashScreen.hide());
							return;
						}
						SplashScreen.hide();
						Yandex.loaded();
						Yandex.play();
						GameState._begun = true;
						GameState._startSound();
					},
				},
			],
		});
	}

	/**
	 * The level is done: the player goes on with `stack`. The next level is loaded, or, after
	 * the last one, the game is over and GameEvent.GAME_COMPLETE goes out.
	 */
	static complete(stack: StackItem[]): void {
		if (GameState._loading) {
			return;
		}
		if (GameState._level < 0) {
			GameState._level = GameState._find();
		}
		const next = GameState._level + 1;
		console.log(`GameState: level ${GameState._level + 1} of ${GameState.levels.length} done`);
		if (GameState._level < 0) {
			console.warn(`GameState: the scene "${director.getScene() && director.getScene().name}" is none of the levels`);
		}
		const last = GameState._level < 0 || next >= GameState.levels.length;
		const carried = stack.slice();
		// The run's count as it was before this level: played again, the level is counted once.
		const before = { ...GameState._totals };
		GameState._addToTotals();
		// Passed, into the cloud — and the next level with what the player takes into it: closed on
		// the results, the game opens there.
		GameState._level >= 0 && Progress.pass(GameState._level, GameState._totals, GameState._stars());
		!last && Progress.enter(next, carried);
		// The results first, the game held still under them; on with the button.
		GameState._loading = true;
		Yandex.pause();
		if (last) {
			// First the end message on black, then — at its end, or skipped — the final screen. The
			// world goes on under the black as it comes up, and stands still only once it is all
			// black: stopped at once, it froze mid-step and the fade looked like a jerk.
			EndMessage.play(
				() => GameState._showFinal(),
				() => director.pause(),
			);
			return;
		}
		director.pause();
		Sfx.ui(Sfx.levelResults);
		ResultsScreen.show(
			GameState._level >= 0 ? I18n.t("level.passed", GameState._level + 1) : I18n.t("level.passedPlain"),
			LevelStats.killed >= LevelStats.zombies && LevelStats.zombies > 0 ? I18n.t("level.allKilled") : I18n.t("level.goodJob"),
			// Between levels just the stars; the numbers wait for the final screen.
			[],
			[
				{
					// The same level again from its start, with what the player came into it with.
					text: I18n.t("level.replay"),
					icon: "replay",
					onClick: () => {
						Yandex.showFullscreen().then(() => {
							director.resume();
							GameState._totals = before;
							GameState._attempt = 1;
							const scene = GameState._level >= 0 ? GameState.levels[GameState._level] : director.getScene().name;
							GameState._load(scene, GameState._entry ? GameState._entry.slice() : null, () => ResultsScreen.hide());
						});
					},
				},
				{
					text: I18n.t(last ? "level.finish" : "level.continue"),
					primary: true,
					icon: "next",
					onClick: () => {
						if (last) {
							director.resume();
							ResultsScreen.hide();
							GameState._loading = false;
							gameEventTarget.emit(GameEvent.GAME_COMPLETE);
							return;
						}
						// Between levels, a full-screen ad: the one right place for it in the game — the
						// level is behind, the next not begun, the world still, and the player has just
						// pressed "continue" of their own accord. How often, the platform guards; no ad,
						// no network, no platform — it answers at once and the level loads as ever. Waited
						// for to its end: the next level must not show through under it.
						Yandex.showFullscreen().then(() => {
							director.resume();
							GameState._attempt = 1;
							// Under the loading screen once it covers them.
							GameState._load(GameState.levels[next], carried, () => ResultsScreen.hide());
						});
					},
				},
			],
			false,
			GameState._stars(),
		);
	}

	/**
	 * The player has died, and the fall has been seen: the same card with what they did, and two
	 * ways on — the level again, with what they came into it with, or the whole game again from
	 * its first level, with nothing.
	 */
	static died(): void {
		if (GameState._loading || !director.getScene()) {
			return;
		}
		// The try is over: gameplay has stopped.
		Yandex.pause();
		ResultsScreen.show(
			I18n.t("death.title"),
			GameState._level >= 0 ? I18n.t("level.title", GameState._level + 1) : "",
			[],
			[
				{ text: I18n.t("death.fromStart"), onClick: () => GameState._confirmFromStart() },
				{ text: I18n.t("death.again"), primary: true, icon: "replay", ad: true, onClick: () => GameState._again() },
			],
			true,
		);
	}

	/**
	 * "From scratch" asks first, the way ThroughTheDeadCity does: the levels passed are lost, and one
	 * tap should not throw them away. "Cancel" is the green one, on the right as on every card — the
	 * safe answer — and brings the death card back.
	 */
	private static _confirmFromStart(): void {
		ResultsScreen.show(
			I18n.t("death.confirmTitle"),
			I18n.t("death.confirmNote"),
			[],
			[
				{
					text: I18n.t("death.wipe"),
					onClick: () => {
						// As it warns: the levels passed are gone, from the cloud too.
						Progress.wipe();
						GameState.restartGame(() => ResultsScreen.hide());
					},
				},
				{ text: I18n.t("death.keep"), primary: true, onClick: () => GameState.died() },
			],
			true,
		);
	}

	/**
	 * "Once more": the same level from its start, after a full-screen ad — the platform's logical
	 * pause, the player has just died and pressed the button, nobody is steering; how often one is
	 * shown the platform decides. The level starts whatever the ad did. Not a rewarded video: the
	 * platform allows one only on a button of the player's choice that says it is an ad and what it
	 * gives, and never for what the game cannot go on without — and playing again is that.
	 */
	private static _again(): void {
		Yandex.showFullscreen().then(() => GameState.restart(() => ResultsScreen.hide()));
	}

	/** The game from its first level, carrying nothing — as if it had just been started. */
	static restartGame(onCovered: () => void = null): void {
		if (GameState._loading || !GameState.levels.length) {
			return;
		}
		GameState._attempt = 1;
		GameState._entry = null;
		GameState._totals = GameState._freshTotals();
		// All from the start, as at the first launch: the intro speaks again on the first level.
		Intro.reset();
		// The game's own tune again, if the final one was playing.
		Sfx.playMusic();
		GameState._load(GameState.levels[0], null, onCovered);
	}

	/** The level just done, into the run's totals. */
	private static _addToTotals(): void {
		const t = GameState._totals;
		t.levels++;
		t.zombies += LevelStats.zombies;
		t.killed += LevelStats.killed;
		t.byTraps += LevelStats.byTraps;
		t.byBarrels += LevelStats.byBarrels;
		t.thrown += LevelStats.thrown;
		t.collected += LevelStats.collected;
		t.barrels += LevelStats.barrels;
		t.seconds += LevelStats.seconds;
		t.deaths += GameState._attempt - 1;
		t.stars += GameState._stars();
	}

	/**
	 * The game starts — the "play" button, the first touch the browser lets sound out on: the
	 * music round and round. On the first level the intro is set: the controls hint goes up, and
	 * the player's first move starts the voice, its text typed under it (Intro). A game started on
	 * another level (a preview of it) gets the music alone.
	 */
	private static _startSound(): void {
		Sfx.playMusic();
		GameState._level === 0 && Intro.arm();
	}

	/** Out of the last level: the final picture with what the player did over the whole game. */
	private static _showFinal(): void {
		const t = GameState._totals;
		const seconds = Math.round(t.seconds);
		// Only how long the whole way took and the stars gathered on it, of all there were.
		const rows: ResultsRow[] = [
			{ icon: "⏱️", label: I18n.t("row.time"), value: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` },
			{ icon: "⭐", label: I18n.t("row.stars"), value: `${t.stars} / ${t.levels * 3}` },
		];
		gameEventTarget.emit(GameEvent.GAME_COMPLETE);
		Yandex.pause();
		Sfx.playMusic(true);
		SplashScreen.show({
			image: "ui/final",
			title: I18n.t("final.title"),
			subtitle: I18n.t("final.subtitle"),
			rows,
			buttons: [
				{
					text: I18n.t("final.again"),
					primary: true,
					onClick: () => {
						director.resume();
						// The final screen held the loading flag: a new run starts clean.
						GameState._loading = false;
						// A new run: from the first level, the levels passed kept.
						Progress.newRun();
						GameState.restartGame(() => SplashScreen.hide());
					},
				},
			],
		});
	}

	/**
	 * Stars for a level passed, of three, by the zombies killed on it (bats among them): all of
	 * them — three; half or more — two; fewer — one, for getting through. A level with none — three.
	 */
	private static _stars(): number {
		const all = LevelStats.zombies;
		if (all <= 0 || LevelStats.killed >= all) {
			return 3;
		}
		return LevelStats.killed * 2 >= all ? 2 : 1;
	}

	/** The current level again from its start, with what the player came into it with. */
	static restart(onCovered: () => void = null): void {
		const scene = director.getScene();
		if (GameState._loading || !scene) {
			return;
		}
		const name = GameState._level >= 0 ? GameState.levels[GameState._level] : scene.name;
		GameState._attempt++;
		GameState._load(name, GameState._entry ? GameState._entry.slice() : null, onCovered);
	}

	/**
	 * Which of `levels` is playing: by the scene's name, or, where the scene is not named as
	 * its file — a preview of the open scene — by its uuid, which is the scene asset's.
	 */
	private static _find(): number {
		const scene = director.getScene();
		if (!scene) {
			return -1;
		}
		const byName = GameState.levels.indexOf(scene.name);
		if (byName >= 0) {
			return byName;
		}
		return GameState.levels.findIndex((name) => {
			const info = assetManager.main && assetManager.main.getSceneInfo(name);
			return !!info && info.uuid === scene.uuid;
		});
	}

	/** `onCovered` — once the loading screen covers the game, before the scene is fetched. */
	private static _load(scene: string, carried: StackItem[], onCovered: () => void = null): void {
		console.log(`GameState: loading ${scene}`);
		GameState._loading = true;
		// The level goes: gameplay stops the moment the world does, under the loading screen.
		Yandex.pause();
		// Leaving the level the intro speaks on cuts it off; the same level again (a death) does not.
		const current = GameState._level >= 0 ? GameState.levels[GameState._level] : null;
		current !== scene && Intro.stop();
		const level = GameState.levels.indexOf(scene);
		const title = level >= 0 ? I18n.t("level.title", level + 1) : "";
		// Covered first; then the scene is fetched with the bar filling, and started.
		LoadingScreen.show(title, () => {
			onCovered && onCovered();
			director.preloadScene(
				scene,
				(done: number, total: number) => LoadingScreen.progress(total > 0 ? done / total : 0),
				(error: Error) => {
					if (error) {
						GameState._fail(scene, error);
						return;
					}
					GameState._carried = carried;
					// The bar drawn full and the ring handed to the system before the scene is made: the
					// making holds the page up for a long moment, and the screen must be up to date before it.
					LoadingScreen.afterFrames(2, () => {
						const started = director.loadScene(scene, () => {
							// Uncovered by the level's warm-up once it is done (Prewarm); a scene that has
							// none is uncovered as soon as it has drawn its first frame.
							director.once(Director.EVENT_AFTER_DRAW, () => !Prewarm.active && LoadingScreen.hide());
						});
						if (!started) {
							GameState._fail(scene, null);
						}
					});
				},
			);
		});
	}

	private static _fail(scene: string, error: Error): void {
		console.error(`GameState: the scene "${scene}" could not be loaded — is it in the build?`, error || "");
		GameState._loading = false;
		GameState._carried = null;
		LoadingScreen.hide();
	}
}

// The page locked to the game's controls, and the platform asked for, as soon as the scripts are
// up, while the first level is still loading.
lockPage();
GameState.platform();
