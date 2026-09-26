import { assetManager, Director, director } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";
import { LoadingScreen } from "./LoadingScreen";

/** One thing on the stack on the player's back: a potion, or a key of a colour. */
export interface StackItem {
	key: boolean;
	color: number;
}

// What lives across the levels, and how the game goes from one to the next. Every level is a
// scene of its own; they come in the order of `levels`. Leaving a level through its gate
// takes what the player carries — the stack on the back, potions and keys, bottom to top —
// into the next one, where it is laid back on the stack as it was. The player who dies plays
// the level again from its start, with what they came in with. The switch of scenes is hidden
// behind the loading screen, its bar filling as the next scene loads.
export class GameState {
	/** The level scenes, in the order they are played. */
	static readonly levels: string[] = ["Level_1", "Level_2", "Level_3", "Level_4", "Level_5", "Level_6", "Level_7", "Level_8", "Level_9", "Level_10"];

	private static _level = -1;
	/** What the player brings into the level being loaded; null — the level's own start. */
	private static _carried: StackItem[] = null;
	/** What the player came into the current level with, for playing it again. */
	private static _entry: StackItem[] = null;
	private static _loading = false;

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
		return carried;
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
		if (GameState._level < 0 || next >= GameState.levels.length) {
			gameEventTarget.emit(GameEvent.GAME_COMPLETE);
			return;
		}
		GameState._load(GameState.levels[next], stack.slice());
	}

	/** The current level again from its start, with what the player came into it with. */
	static restart(): void {
		const scene = director.getScene();
		if (GameState._loading || !scene) {
			return;
		}
		const name = GameState._level >= 0 ? GameState.levels[GameState._level] : scene.name;
		GameState._load(name, GameState._entry ? GameState._entry.slice() : null);
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

	private static _load(scene: string, carried: StackItem[]): void {
		console.log(`GameState: loading ${scene}`);
		GameState._loading = true;
		const level = GameState.levels.indexOf(scene);
		const title = level >= 0 ? `Уровень ${level + 1}` : "";
		// Covered first; then the scene is fetched with the bar filling, and started.
		LoadingScreen.show(title, () => {
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
						// Uncovered once the new scene has drawn its first frame.
						director.once(Director.EVENT_AFTER_DRAW, () => LoadingScreen.hide());
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
