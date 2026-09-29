import { _decorator, Component, Quat, v3, Vec3 } from "cc";
import { PlayerAttack } from "./PlayerAttack";
import { PotionKind } from "./PotionKind";

const { ccclass } = _decorator;

const enum State {
	/** Out of the zombie, arcing to where it lands. */
	Falling,
	/** The little hop after it hits the floor. */
	Bouncing,
	/** Lying on its side, waiting for the player. */
	Lying,
	/** Taken: arcing up onto the stack on the player's back. */
	Collected,
}

/** How a dropped potion moves — handed over by PotionDrops. */
export interface DropSettings {
	fallTime: number;
	arcHeight: number;
	bounceHeight: number;
	bounceTime: number;
	spinSpeed: number;
	pickupRadius: number;
	collectSpeed: number;
	collectArc: number;
	catchHeight: number;
}

const _at = v3();
const _to = v3();
const _rotation = new Quat();

// A potion a zombie dropped (PotionDrops): it flies in an arc from where the zombie fell to its
// spot on the floor, tumbling, hops once and lies there along the floor, resting on its side. The player walking up to
// it takes it — it arcs onto the top of the stack on their back and is a shot more to fire.
// It lives on its own, so it outlasts the zombie sinking away.
@ccclass("DroppedPotion")
export class DroppedPotion extends Component {
	private _settings: DropSettings = null;
	/** Plain, or seldom a bomb or a drone: it goes onto the stack as what it is. */
	private _kind: PotionKind = PotionKind.Plain;
	private _state = State.Falling;
	private _start = v3();
	private _end = v3();
	private _time = 0;
	private _duration = 0;
	private _height = 0;
	private _yaw = 0;
	private _spin = 0;

	/** Off it goes, from `from` to lie at `to`. */
	launch(from: Vec3, to: Vec3, settings: DropSettings, kind: PotionKind = PotionKind.Plain): void {
		this._settings = settings;
		this._kind = kind;
		this._start.set(from);
		this._end.set(to);
		this._duration = settings.fallTime * (0.85 + Math.random() * 0.3);
		this._height = settings.arcHeight * (0.8 + Math.random() * 0.4);
		this._yaw = Math.random() * 360;
		this._spin = settings.spinSpeed * (Math.random() < 0.5 ? -1 : 1);
		this._state = State.Falling;
		this._time = 0;
		this.node.setWorldPosition(from);
	}

	protected update(dt: number): void {
		if (!this._settings) {
			return;
		}
		this._time += dt;
		switch (this._state) {
			case State.Falling:
				this._fall();
				break;
			case State.Bouncing:
				this._bounce();
				break;
			case State.Lying:
				this._wait();
				break;
			case State.Collected:
				this._collect();
				break;
		}
	}

	private _fall(): void {
		const t = Math.min(1, this._time / this._duration);
		Vec3.lerp(_at, this._start, this._end, t);
		_at.y += this._height * 4 * t * (1 - t);
		this.node.setWorldPosition(_at);
		// Tumbling end over end, and coming down lying along the floor (its long axis is its local X).
		this._turn(this._spin * (this._time - this._duration));
		if (t >= 1) {
			this._state = State.Bouncing;
			this._time = 0;
		}
	}

	private _bounce(): void {
		const settings = this._settings;
		const t = Math.min(1, this._time / Math.max(settings.bounceTime, 0.01));
		_at.set(this._end);
		_at.y += settings.bounceHeight * 4 * t * (1 - t);
		this.node.setWorldPosition(_at);
		this._turn(0);
		if (t >= 1) {
			this._state = State.Lying;
			this._time = 0;
		}
	}

	/** Lying there until the player comes for it. */
	private _wait(): void {
		const player = PlayerAttack.instance;
		if (!player || player.isDead) {
			return;
		}
		const at = this.node.worldPosition;
		const them = player.node.worldPosition;
		if (Math.hypot(them.x - at.x, them.z - at.z) > this._settings.pickupRadius) {
			return;
		}
		this._state = State.Collected;
		this._time = 0;
		this._start.set(at);
	}

	/** Up onto the stack in an arc, following the top of it; once there, it lies on the stack. */
	private _collect(): void {
		const settings = this._settings;
		const player = PlayerAttack.instance;
		if (!player || player.isDead) {
			this.node.destroy();
			return;
		}
		player.catchPoint(_to, settings.catchHeight);
		const distance = Math.hypot(_to.x - this._start.x, _to.z - this._start.z);
		const duration = Math.max(0.15, distance / Math.max(settings.collectSpeed, 0.01));
		const t = Math.min(1, this._time / duration);
		if (t >= 1) {
			// On the stack a potion again, of its kind.
			this._settings = null;
			this.destroy();
			player.addAmmo(1, this.node, this._kind);
			return;
		}
		Vec3.lerp(_at, this._start, _to, t);
		_at.y += settings.collectArc * 4 * t * (1 - t);
		this.node.setWorldPosition(_at);
		this._turn(-settings.spinSpeed * this._time);
	}

	private _turn(roll: number): void {
		Quat.fromEuler(_rotation, 0, this._yaw, roll);
		this.node.setWorldRotation(_rotation);
	}
}
