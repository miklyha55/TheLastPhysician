import { _decorator, math, Node, tween, v3, Vec3 } from "cc";
import { Mode, Zombie } from "./Zombie";
import { PlayerAttack } from "./PlayerAttack";
import { Sfx } from "../managers/audio/Sfx";

const { ccclass, property } = _decorator;

const HANG = "idle";
const FLY = "run";

// A bat. It hangs high in the air, anywhere over the floor, asleep, until the player comes within
// `detectRadius` with nothing but walls to keep them apart — tables, chests and barrels it sees
// over and flies over. Then it drops and comes at them in a spiral, circling closer and closer, and
// darts straight in for the last of the way: its bite takes the player's life. The walls are its only borders: it flies round nothing, and
// once the player is behind a wall for `loseSightTime`, or further than `loseRadius`, it gives up
// and flies back up to where it hung. One potion kills it: it falls to the floor and is gone.
//
// To the rest of the game it is one more zombie — the player aims at it, turns to the nearest of
// them, a burst or a barrel kills it, and it counts among the level's kills. Its node stands on
// the floor under it, so every distance on the floor is measured as for a zombie; only the model
// (`model`) is up in the air. A hanging bat is its idle state, a flying one its run.
@ccclass("Bat")
export class Bat extends Zombie {
	@property({ type: Node, tooltip: "What hangs and flies over the node: the model; the node itself stays on the floor" })
	model: Node = null;
	@property({ tooltip: "Height of the model over the floor while it hangs" })
	hangHeight: number = 1.05;
	@property({ tooltip: "Height of the model over the floor in flight" })
	flyHeight: number = 0.5;
	@property({
		tooltip:
			"Degrees the model leans about its side axis while it hangs: the hanging clip lies on its back, this stands it upright, head down and feet up as if clinging to the ceiling. It straightens out as the bat drops into flight",
	})
	hangTilt: number = -51.3;
	@property({ tooltip: "Playback speed of the flight clip: how fast the wings beat" })
	flapSpeed: number = 2;
	@property({ tooltip: "Units per second it drops to its flight or rises back to its perch" })
	climbSpeed: number = 1.6;
	@property({
		tooltip:
			"Degrees its flight turns off the straight line to the player: 0 — straight at them, towards 90 — circling them without coming closer. The spiral tightens at the same angle all the way in",
		slide: true,
		range: [0, 85, 1],
	})
	spiralAngle: number = 60;
	@property({ tooltip: "This near the player it stops circling and darts straight in, units" })
	spiralEnd: number = 0.6;
	@property({ tooltip: "How near its perch it has to come to hang up again, units" })
	perchReach: number = 0.06;
	@property({ tooltip: "Seconds a dead bat takes to fall to the floor" })
	fallTime: number = 0.35;
	@property({ tooltip: "Seconds it lies on the floor before it goes" })
	lieTime: number = 0.6;
	@property({ tooltip: "Seconds it takes to shrink away" })
	shrinkTime: number = 0.3;

	private _homing = false;
	/** Which way round it circles: 1 or -1, turned over when a wall is in the way. */
	private _round = 1;
	private _heading = v3();
	private _to = v3();
	private _aim = v3();

	get flies(): boolean {
		return true;
	}

	get aimLift(): number {
		return this.model ? this.model.position.y : this.flyHeight;
	}

	protected start(): void {
		super.start();
		const flight = this.animation && this.animation.getState(FLY);
		flight && (flight.speed = this.flapSpeed);
		this._round = Math.random() < 0.5 ? 1 : -1;
		this._lift(this.hangHeight);
	}

	// --- hanging

	/** Hangs where it was put, asleep; it never wanders about. */
	protected _stand(): void {
		super._stand();
		this._timer = Infinity;
	}

	/** A bat cries — as it drops at the player and as it falls; asleep it is silent. */
	protected _voice(): string | string[] {
		return Sfx.bat;
	}

	// --- the flight

	/** The player noticed: off the perch and at them. */
	protected _engage(): void {
		this._homing = false;
		this._unseen = 0;
		this._mode = Mode.Hunt;
		this._play(FLY);
	}

	/** Back up to the perch — whatever lost it the player. */
	protected _goHome(): void {
		this._homing = true;
		this._mode = Mode.Hunt;
		this._play(FLY);
	}

	protected _updateHunt(player: PlayerAttack, dt: number): void {
		if (this._homing) {
			return this._updateHome(player, dt);
		}
		if (!player || player.isDead) {
			return this._goHome();
		}
		const at = this.node.worldPosition;
		const target = player.node.worldPosition;
		const distance = Math.hypot(target.x - at.x, target.z - at.z);
		if (distance > this.loseRadius) {
			return this._goHome();
		}
		// Behind a wall long enough, it loses them; over a table it sees them all the same.
		const walls = this._walls();
		if (walls && !walls.lineOfSight(at, target, this.height)) {
			if ((this._unseen += dt) >= this.loseSightTime) {
				return this._goHome();
			}
		} else {
			this._unseen = 0;
		}
		if (distance <= this.attackDistance && this._height() <= this.flyHeight + 0.15) {
			// The bite, once: it takes the player's life, and the bat flies off to its perch.
			player.takeHit(this.model ? this.model.worldPosition : at);
			return this._goHome();
		}
		this._flyTo(target, this.chaseSpeed, dt, distance > this.spiralEnd ? this.spiralAngle : 0);
		this._climb(this.flyHeight, dt);
	}

	private _updateHome(player: PlayerAttack, dt: number): void {
		if (this._notices(player)) {
			// Noticed again on the way back: another cry, and after them.
			return this._aggro();
		}
		const at = this.node.worldPosition;
		const left = Math.hypot(this._home.x - at.x, this._home.z - at.z);
		if (left > this.perchReach) {
			this._flyTo(this._home, this.wanderSpeed, dt, 0);
			// Up to the perch's height only once nearly under it: over the room it flies low.
			this._climb(left < 1 ? this.hangHeight : this.flyHeight, dt);
			return;
		}
		this.node.setWorldPosition(this._home.x, at.y, this._home.z);
		if (this._climb(this.hangHeight, dt)) {
			this._homing = false;
			this._stand();
		}
	}

	/**
	 * A step of the flight towards `goal`, turned `spiral` degrees off the straight line to it —
	 * round it and in at once, which draws a spiral closing on it. Stopped only by walls.
	 */
	private _flyTo(goal: Vec3, speed: number, dt: number, spiral: number): void {
		const at = this.node.worldPosition;
		Vec3.subtract(this._heading, goal, at);
		this._heading.y = 0;
		const length = this._heading.length();
		if (length < 1e-4) {
			return;
		}
		this._heading.multiplyScalar(1 / length);
		if (spiral > 0) {
			// The straight line to the goal, turned round it one way or the other.
			const angle = math.toRadian(spiral) * this._round;
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			const x = this._heading.x;
			this._heading.x = x * cos - this._heading.z * sin;
			this._heading.z = x * sin + this._heading.z * cos;
		}
		const step = Math.min(speed * dt, length);
		this._to.set(at.x + this._heading.x * step, at.y, at.z + this._heading.z * step);
		this._keepApart(this._to);
		if (this._clear(at, this._to)) {
			this.node.setWorldPosition(this._to);
		} else if (spiral > 0) {
			// A wall across the circle: round the other way.
			this._round = -this._round;
		}
		this._aim.set(at.x + this._heading.x, at.y, at.z + this._heading.z);
		this._turnTo(this._aim, dt);
	}

	/** Keeps a step out of the walls — only walls: what is lower it flies over. The whole step, one axis of it, or none. */
	private _clear(from: Vec3, to: Vec3): boolean {
		const walls = this._walls();
		const over = this.height;
		if (!walls || !walls.isBlockedAbove(to.x, to.z, this.radius, over)) {
			return true;
		}
		if (!walls.isBlockedAbove(to.x, from.z, this.radius, over)) {
			to.z = from.z;
			return true;
		}
		if (!walls.isBlockedAbove(from.x, to.z, this.radius, over)) {
			to.x = from.x;
			return true;
		}
		return false;
	}

	// --- height

	private _height(): number {
		return this.model ? this.model.position.y : 0;
	}

	private _lift(height: number): void {
		if (!this.model) {
			return;
		}
		const p = this.model.position;
		this.model.setPosition(p.x, height, p.z);
		// Upright, head down, at its perch; level in flight; between the two on the way.
		const span = this.hangHeight - this.flyHeight;
		const hang = span > 1e-4 ? math.clamp01((height - this.flyHeight) / span) : 1;
		this.model.setRotationFromEuler(this.hangTilt * hang, 0, 0);
	}

	/** Towards `height` at the climb speed; true once there. */
	private _climb(height: number, dt: number): boolean {
		const now = this._height();
		const next = now + math.clamp(height - now, -this.climbSpeed * dt, this.climbSpeed * dt);
		this._lift(next);
		return Math.abs(height - next) < 1e-3;
	}

	// --- dying

	/** Shot down: the wings stop, it drops to the floor, lies a moment and shrinks away. */
	protected _vanish(): void {
		const node = this.node;
		this.animation && this.animation.pause();
		const model = this.model;
		if (!model) {
			tween(node).delay(this.lieTime).to(this.shrinkTime, { scale: v3(0, 0, 0) }).call(() => node.destroy()).start();
			return;
		}
		const p = model.position;
		const turn = model.eulerAngles.clone();
		tween(model)
			.to(this.fallTime, { position: v3(p.x, 0.05, p.z), eulerAngles: v3(turn.x + 80, turn.y, turn.z + 30) }, { easing: "quadIn" })
			.delay(this.lieTime)
			.to(this.shrinkTime, { scale: v3(0, 0, 0) }, { easing: "quadIn" })
			.call(() => node.destroy())
			.start();
	}
}
