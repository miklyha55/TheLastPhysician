import { math, Node, tween, v3, Vec3 } from "cc";
import type { PathFinder } from "./PathFinder";
import type { Zombie } from "./Zombie";

// A yellow potion after its first hit: a drone. It keeps the zombies that were on the screen the
// moment it was thrown — those and no others — and flies to them one after another, the nearest
// next, the way round the walls as a zombie would walk it, and takes two lives off each it reaches (PlayerAttack.droneDamage). A zombie
// dead meanwhile is struck off; one it cannot get to, or does not reach in `giveUp` seconds, it
// leaves. When none is left it shrinks away. PlayerAttack drives it, frame by frame.

export interface DroneOptions {
	/** Units per second. */
	speed: number;
	/** Height over the floor it flies at. */
	height: number;
	/** How near it has to come to a zombie to kill it. */
	reach: number;
	/** How often the way to the zombie it is after is found again, seconds. */
	repath: number;
	/** Seconds it tries for one zombie before leaving it. */
	giveUp: number;
	/** Turns a second it spins at, degrees. */
	spin: number;
}

export class PotionDrone {
	private _path: Vec3[] = [];
	private _target: Zombie = null;
	private _repathIn = 0;
	private _chasing = 0;
	private _time = 0;
	private _done = false;
	private _step = v3();

	constructor(
		private readonly _node: Node,
		private readonly _targets: Zombie[],
		private readonly _finder: PathFinder,
		private readonly _options: DroneOptions,
		/** A zombie reached: the player takes its lives off it (blood, the count). */
		private readonly _kill: (zombie: Zombie, from: Vec3) => void,
		/** Nothing more to fly to: the node, shrunk to nothing, is done with. */
		private readonly _finish: (node: Node) => void,
	) {}

	/** One frame; true once it is over. */
	update(dt: number): boolean {
		if (this._done) {
			return true;
		}
		this._time += dt;
		const target = this._current();
		if (!target) {
			this._end();
			return true;
		}
		const at = this._node.worldPosition;
		const goal = target.node.worldPosition;
		if ((this._repathIn -= dt) <= 0) {
			this._repathIn = this._options.repath;
			if (!this._finder || !this._finder.find(at, goal, this._path) || !this._path.length || Math.hypot(this._path[this._path.length - 1].x - goal.x, this._path[this._path.length - 1].z - goal.z) > 0.6) {
				// No way there: this one is left.
				this._strike(target);
				return false;
			}
		} else if (this._path.length) {
			// It moves between searches; the last leg ends where it is now.
			this._path[this._path.length - 1].set(goal);
		}
		if ((this._chasing += dt) > this._options.giveUp) {
			this._strike(target);
			return false;
		}
		if (Math.hypot(goal.x - at.x, goal.z - at.z) <= this._options.reach) {
			this._kill(target, at.clone());
			this._strike(target);
			return false;
		}
		this._fly(dt);
		return false;
	}

	/** The zombie it is after: the one it had, while alive, else the nearest of those left. */
	private _current(): Zombie {
		const alive = (zombie: Zombie) => zombie && zombie.isValid && zombie.node && zombie.node.isValid && !zombie.isDead;
		for (let i = this._targets.length - 1; i >= 0; i--) {
			if (!alive(this._targets[i])) {
				this._targets.splice(i, 1);
			}
		}
		if (alive(this._target)) {
			return this._target;
		}
		const at = this._node.worldPosition;
		let best: Zombie = null;
		let bestDistance = Infinity;
		for (const zombie of this._targets) {
			const distance = Vec3.squaredDistance(zombie.node.worldPosition, at);
			if (distance < bestDistance) {
				bestDistance = distance;
				best = zombie;
			}
		}
		this._target = best;
		this._chasing = 0;
		this._repathIn = 0;
		return best;
	}

	/** Done with this one, dead or left: on to the next. One left alive may be shot at again. */
	private _strike(zombie: Zombie): void {
		const index = this._targets.indexOf(zombie);
		index >= 0 && this._targets.splice(index, 1);
		zombie && zombie.isValid && !zombie.isDead && (zombie.doomed = false);
		this._target = null;
	}

	/** Along the way, at its height, bobbing and spinning. */
	private _fly(dt: number): void {
		const at = this._node.worldPosition;
		let left = this._options.speed * dt;
		let x = at.x;
		let z = at.z;
		while (left > 0 && this._path.length) {
			const point = this._path[0];
			const dx = point.x - x;
			const dz = point.z - z;
			const length = Math.hypot(dx, dz);
			if (length <= left) {
				x = point.x;
				z = point.z;
				left -= length;
				this._path.length > 1 ? this._path.shift() : (left = 0);
				continue;
			}
			x += (dx / length) * left;
			z += (dz / length) * left;
			left = 0;
		}
		// Up to its height from wherever the throw left it, a little bob on top.
		const height = this._options.height + Math.sin(this._time * 9) * 0.04;
		const y = math.lerp(at.y, height, Math.min(1, dt * 8));
		Vec3.subtract(this._step, v3(x, y, z), at);
		this._node.setWorldPosition(x, y, z);
		const yaw = Math.hypot(this._step.x, this._step.z) > 1e-5 ? math.toDegree(Math.atan2(this._step.x, this._step.z)) : this._node.eulerAngles.y;
		this._node.setRotationFromEuler(0, yaw - 90, -this._options.spin * this._time);
	}

	private _end(): void {
		this._done = true;
		this._targets.forEach((zombie) => zombie && zombie.isValid && (zombie.doomed = false));
		const node = this._node;
		tween(node)
			.to(0.2, { scale: v3(0, 0, 0) }, { easing: "quadIn" })
			.call(() => this._finish(node))
			.start();
	}
}
