import { _decorator, Component, Node, Quat, tween, v3, Vec3 } from "cc";
import KeyColor from "../enums/KeyColor";
import { Door } from "./Door";
import { PlayerAttack } from "./PlayerAttack";
import { PlayerKeys } from "./PlayerKeys";

const { ccclass, property } = _decorator;

// A door of a colour, shut: a wall. One key of its colour opens it, and is spent on it. When
// the player carrying one comes up to the door, the key leaves the stack on their back, flies
// into the door and is gone, and the door swings open and stays open.
@ccclass("LockedDoor")
export class LockedDoor extends Component {
	@property({ type: KeyColor }) color: number = KeyColor.Red;
	@property({ tooltip: "The player with the key opens the door this close to its centre, on the floor" })
	openDistance: number = 0.6;
	@property({ tooltip: "Speed of the key's flight into the door, units per second" })
	flySpeed: number = 3;
	@property({ tooltip: "How high the key's flight arcs" })
	flyArc: number = 0.35;
	@property({ tooltip: "Height above the floor the key flies into the door at — the lock" })
	lockHeight: number = 0.5;
	@property({ tooltip: "Seconds the key takes to vanish in the lock" })
	vanishTime: number = 0.15;

	private _door: Door = null;
	private _unlocking = false;
	private _key: Node = null;
	private _time = 0;
	private _duration = 0;
	private _start = v3();
	private _to = v3();
	private _at = v3();
	private _rotation = new Quat();

	protected start(): void {
		this._door = this.getComponent(Door);
	}

	protected update(dt: number): void {
		if (this._key) {
			this._fly(dt);
			return;
		}
		const keys = PlayerKeys.instance;
		if (this._unlocking || !this._door || this._door.isOpen || !keys || !keys.has(this.color)) {
			return;
		}
		// A key still on its way to the stack is waited for, so it is the one that flies here.
		const stack = PlayerAttack.instance && PlayerAttack.instance.stack;
		if (stack && !stack.hasKey(this.color)) {
			return;
		}
		const at = this.node.worldPosition;
		const player = keys.node.worldPosition;
		if (Math.hypot(player.x - at.x, player.z - at.z) <= this.openDistance) {
			this._unlock(keys);
		}
	}

	private _unlock(keys: PlayerKeys): void {
		this._unlocking = true;
		keys.take(this.color);
		const stack = PlayerAttack.instance && PlayerAttack.instance.stack;
		const key = stack && stack.takeKey(this.color);
		if (!key) {
			// No key in sight to fly: the door simply opens.
			this._door.setOpen(true);
			return;
		}
		// Out of the stack into the level, where it is, then off to the lock.
		const from = key.worldPosition.clone();
		key.setParent(this.node.parent, true);
		key.setWorldPosition(from);
		this._key = key;
		this._start.set(from);
		const at = this.node.worldPosition;
		this._to.set(at.x, at.y + this.lockHeight, at.z);
		this._duration = Math.max(0.2, Vec3.distance(this._start, this._to) / Math.max(this.flySpeed, 0.01));
		this._time = 0;
	}

	private _fly(dt: number): void {
		const key = this._key;
		if (!key.isValid) {
			this._key = null;
			this._door.setOpen(true);
			return;
		}
		this._time += dt;
		const t = Math.min(1, this._time / this._duration);
		Vec3.lerp(this._at, this._start, this._to, t);
		this._at.y += this.flyArc * 4 * t * (1 - t);
		key.setWorldPosition(this._at);
		Quat.fromEuler(this._rotation, 90 - t * 90, t * 540, 0);
		key.setWorldRotation(this._rotation);
		if (t < 1) {
			return;
		}
		// In the lock: the key is gone and the door opens.
		this._key = null;
		this._door.setOpen(true);
		tween(key)
			.to(this.vanishTime, { scale: v3() })
			.call(() => key.destroy())
			.start();
	}
}
