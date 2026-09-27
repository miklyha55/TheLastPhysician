import { _decorator, Component, director, Director, EventKeyboard, game, Game, Input, input, KeyCode, v2, Vec2 } from "cc";
import GameEvent from "../../enums/GameEvent";
import { gameEventTarget } from "../../plugins/GameEventTarget";

const { ccclass } = _decorator;

/** Which way each key pushes: x right, y away from the camera (screen up). */
const KEYS: { [code: number]: [number, number] } = {
	[KeyCode.KEY_W]: [0, 1],
	[KeyCode.ARROW_UP]: [0, 1],
	[KeyCode.KEY_S]: [0, -1],
	[KeyCode.ARROW_DOWN]: [0, -1],
	[KeyCode.KEY_A]: [-1, 0],
	[KeyCode.ARROW_LEFT]: [-1, 0],
	[KeyCode.KEY_D]: [1, 0],
	[KeyCode.ARROW_RIGHT]: [1, 0],
};

// The player moved from the keyboard — WASD and the arrows — the way the on-screen joystick
// moves them: the same events go out. A first key held is the finger down, the direction of
// the keys held is where the knob points, the last one let go is the finger up. Two keys at
// once go diagonally; opposite ones cancel out. It outlives the scenes (GameManager's node): keys
// held across a change of level are told to the new one afresh, or its player would move with no
// "finger down" heard — no run, no turning. Losing the page's focus lets every key go, since
// their key-ups will never come.
@ccclass("KeyboardInput")
export class KeyboardInput extends Component {
	private _held = new Set<number>();
	private _direction: Vec2 = v2();
	private _down = false;

	protected onEnable(): void {
		input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
		input.on(Input.EventType.KEY_UP, this._onKeyUp, this);
		director.on(Director.EVENT_AFTER_SCENE_LAUNCH, this._announce, this);
		game.on(Game.EVENT_HIDE, this._releaseAll, this);
		typeof window !== "undefined" && window.addEventListener("blur", this._onBlur);
	}

	protected onDisable(): void {
		input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
		input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
		director.off(Director.EVENT_AFTER_SCENE_LAUNCH, this._announce, this);
		game.off(Game.EVENT_HIDE, this._releaseAll, this);
		typeof window !== "undefined" && window.removeEventListener("blur", this._onBlur);
		this._releaseAll();
	}

	private _onBlur = (): void => this._releaseAll();

	/** A new scene: whatever is held down is news to it — the finger down, the way, the move. */
	private _announce(): void {
		this._down = false;
		this._held.size && this._update();
	}

	private _releaseAll(): void {
		this._held.clear();
		this._update();
	}

	private _onKeyDown(event: EventKeyboard): void {
		if (!KEYS[event.keyCode] || this._held.has(event.keyCode)) {
			return;
		}
		this._held.add(event.keyCode);
		this._update();
	}

	private _onKeyUp(event: EventKeyboard): void {
		if (!this._held.delete(event.keyCode)) {
			return;
		}
		this._update();
	}

	/** The joystick's events for what is held now. */
	private _update(): void {
		let x = 0;
		let y = 0;
		this._held.forEach((code) => {
			x += KEYS[code][0];
			y += KEYS[code][1];
		});
		const moving = x !== 0 || y !== 0;
		if (moving && !this._down) {
			this._down = true;
			gameEventTarget.emit(GameEvent.JOYSTICK_DOWN, null);
		}
		this._direction.set(x, y);
		gameEventTarget.emit(GameEvent.MOVE_DIRECTION, this._direction);
		if (moving) {
			gameEventTarget.emit(GameEvent.JOYSTICK_MOVE, null);
		} else if (this._down) {
			this._down = false;
			gameEventTarget.emit(GameEvent.JOYSTICK_UP, null);
		}
	}
}
