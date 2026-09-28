import { assetManager, Director, director } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";
import { LevelStats } from "./LevelStats";
import { LoadingScreen } from "./LoadingScreen";
import { Prewarm } from "./Prewarm";
import { ResultsScreen, ResultsRow } from "./ResultsScreen";
import { SplashScreen } from "./SplashScreen";
import { Sfx } from "./audio/Sfx";
import { Sound } from "./audio/Sound";
import { InputLock } from "./input/InputLock";

/** One thing on the stack on the player's back: a potion, or a key of a colour. */
export interface StackItem {
	key: boolean;
	color: number;
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
	/** What the player did over all the levels done so far in this run of the game. */
	private static _totals = GameState._freshTotals();

	private static _freshTotals() {
		return { levels: 0, zombies: 0, killed: 0, byTraps: 0, byBarrels: 0, thrown: 0, collected: 0, barrels: 0, seconds: 0, deaths: 0 };
	}

	/** What the loading screen calls the level being played. */
	static get title(): string {
		return GameState._level >= 0 ? `Уровень ${GameState._level + 1}` : "";
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
		// The very first level of a run: the start screen over it, with the button to play.
		if (!GameState._started) {
			GameState._started = true;
			GameState._showStart();
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
			}
		}, 100);
		SplashScreen.show({
			image: "ui/start",
			title: "The Last Physician",
			subtitle: "Выберись из подземелья",
			buttons: [
				{
					text: "Играть",
					primary: true,
					onClick: () => {
						clearInterval(watch);
						held && director.resume();
						SplashScreen.hide();
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
		GameState._addToTotals();
		// The results first, the game held still under them; on with the button.
		GameState._loading = true;
		director.pause();
		if (last) {
			GameState._showFinal();
			return;
		}
		ResultsScreen.show(
			GameState._level >= 0 ? `Уровень ${GameState._level + 1} пройден!` : "Уровень пройден!",
			LevelStats.killed >= LevelStats.zombies && LevelStats.zombies > 0 ? "Все зомби повержены" : "Отличная работа",
			GameState._results(),
			[
				{
					text: last ? "Завершить" : "Продолжить",
					primary: true,
					onClick: () => {
						director.resume();
						if (last) {
							ResultsScreen.hide();
							GameState._loading = false;
							gameEventTarget.emit(GameEvent.GAME_COMPLETE);
							return;
						}
						GameState._attempt = 1;
						// Under the loading screen once it covers them.
						GameState._load(GameState.levels[next], carried, () => ResultsScreen.hide());
					},
				},
			],
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
		ResultsScreen.show(
			"Вы погибли",
			GameState._level >= 0 ? `Уровень ${GameState._level + 1}` : "",
			GameState._results(),
			[
				{ text: "Ещё раз", primary: true, onClick: () => GameState.restart(() => ResultsScreen.hide()) },
				{ text: "Заново", onClick: () => GameState.restartGame(() => ResultsScreen.hide()) },
			],
			true,
		);
	}

	/** The game from its first level, carrying nothing — as if it had just been started. */
	static restartGame(onCovered: () => void = null): void {
		if (GameState._loading || !GameState.levels.length) {
			return;
		}
		GameState._attempt = 1;
		GameState._entry = null;
		GameState._totals = GameState._freshTotals();
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
	}

	/**
	 * The game starts — the "play" button, the first touch the browser lets sound out on: the
	 * music round and round, and the intro in the player's language, the controls held till it
	 * is over (and no longer than `introLimit`, should it never end).
	 */
	private static _startSound(): void {
		// The music down under the voice while it speaks.
		Sfx.duckMusic(true);
		Sfx.playMusic();
		InputLock.lock();
		const done = () => {
			clearTimeout(limit);
			Sfx.duckMusic(false);
			InputLock.unlock();
		};
		const limit = setTimeout(done, GameState.introLimit * 1000);
		const player = director.getScene() && director.getScene().getComponentsInChildren("PlayerAttack")[0];
		Sound.play(Sfx.intro, {
			id: "intro",
			volume: Sfx.gain(Sfx.intro),
			at: player ? player.node : undefined,
			onEnded: done,
		});
	}

	/** Seconds the controls stay held at the most, waiting for the intro to end. */
	static introLimit = 30;

	/** Out of the last level: the final picture with what the player did over the whole game. */
	private static _showFinal(): void {
		const t = GameState._totals;
		const seconds = Math.round(t.seconds);
		const rows: ResultsRow[] = [
			{ icon: "🏰", label: "Уровней пройдено", value: `${t.levels}` },
			{ icon: "🧟", label: "Зомби убито", value: `${t.killed} / ${t.zombies}` },
		];
		const how = GameState._how(t.byTraps, t.byBarrels);
		how && rows.push(how);
		rows.push({ icon: "🧪", label: "Склянок брошено", value: `${t.thrown}` });
		rows.push({ icon: "🎁", label: "Склянок собрано", value: `${t.collected}` });
		t.barrels > 0 && rows.push({ icon: "🛢️", label: "Бочек взорвано", value: `${t.barrels}` });
		rows.push({ icon: "⏱️", label: "Время", value: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` });
		rows.push({ icon: "💀", label: "Смертей", value: `${t.deaths}` });
		gameEventTarget.emit(GameEvent.GAME_COMPLETE);
		Sfx.playMusic(true);
		SplashScreen.show({
			image: "ui/final",
			title: "Свобода!",
			subtitle: "Подземелье пройдено",
			rows,
			buttons: [
				{
					text: "Играть снова",
					primary: true,
					onClick: () => {
						director.resume();
						// The final screen held the loading flag: a new run starts clean.
						GameState._loading = false;
						GameState.restartGame(() => SplashScreen.hide());
					},
				},
			],
		});
	}

	/** How the zombies died besides the potions, in one small line: by traps, by barrels; null — neither. */
	private static _how(traps: number, barrels: number): ResultsRow {
		if (traps > 0 && barrels > 0) {
			return { icon: "🔥", label: "ловушки · бочки", value: `${traps} · ${barrels}`, minor: true };
		}
		if (traps > 0) {
			return { icon: "🔥", label: "ловушками", value: `${traps}`, minor: true };
		}
		if (barrels > 0) {
			return { icon: "💥", label: "взрывами бочек", value: `${barrels}`, minor: true };
		}
		return null;
	}

	/** The lines of the results screen, from what LevelStats counted. */
	private static _results(): ResultsRow[] {
		const rows: ResultsRow[] = [{ icon: "🧟", label: "Зомби убито", value: `${LevelStats.killed} / ${LevelStats.zombies}` }];
		const how = GameState._how(LevelStats.byTraps, LevelStats.byBarrels);
		how && rows.push(how);
		rows.push({ icon: "🧪", label: "Склянок брошено", value: `${LevelStats.thrown}` });
		rows.push({ icon: "🎁", label: "Склянок собрано", value: `${LevelStats.collected}` });
		LevelStats.barrels > 0 && rows.push({ icon: "🛢️", label: "Бочек взорвано", value: `${LevelStats.barrels}` });
		const seconds = Math.round(LevelStats.seconds);
		rows.push({ icon: "⏱️", label: "Время", value: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` });
		rows.push({ icon: "🔁", label: "Попытка", value: `${GameState._attempt}` });
		return rows;
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
		const level = GameState.levels.indexOf(scene);
		const title = level >= 0 ? `Уровень ${level + 1}` : "";
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
					const started = director.loadScene(scene, () => {
						// Uncovered by the level's warm-up once it is done (Prewarm); a scene that has
						// none is uncovered as soon as it has drawn its first frame.
						director.once(Director.EVENT_AFTER_DRAW, () => !Prewarm.active && LoadingScreen.hide());
					});
					if (!started) {
						GameState._fail(scene, null);
					}
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
