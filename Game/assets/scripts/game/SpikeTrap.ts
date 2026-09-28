import { _decorator, Component, Mat4, Node, v3, Vec3 } from "cc";
import { HazardVictims } from "./HazardVictims";
import { PlayerAttack } from "./PlayerAttack";

const { ccclass, property } = _decorator;

// Spikes in a tile — out of the floor, or out of a wall. Hidden from the start, then round and
// round for good: hidden for `closedTime`, shoot out, stay out for `openTime`, draw back. The
// player where they reach while they are out dies. Floor spikes hide straight down and hurt on
// a square round the tile's centre; wall spikes hide back into the wall (`hideDirection`) and
// hurt in a box in front of it (`useBox`), in the tile's own axes — so turned with it.
@ccclass("SpikeTrap")
export class SpikeTrap extends Component {
	@property({ type: Node, tooltip: "The spikes, moving up and down" })
	spikes: Node = null;
	@property({ tooltip: "Seconds hidden" })
	closedTime: number = 2;
	@property({ tooltip: "Seconds up" })
	openTime: number = 1;
	@property({ tooltip: "Seconds to shoot up" })
	riseTime: number = 0.08;
	@property({ tooltip: "Seconds to sink back" })
	sinkTime: number = 0.25;
	@property({ tooltip: "How far below their raised place the spikes hide" })
	hiddenDepth: number = 0.18;
	@property({ tooltip: "Which way, in the tile's axes, the spikes draw back to hide: down into the floor, back into a wall" })
	hideDirection: Vec3 = v3(0, -1, 0);
	@property({ tooltip: "Hide by squashing towards the tile's middle along hideDirection instead of sliding: blades longer than their wall is thick" })
	squash: boolean = false;
	@property({ tooltip: "With squash: how much of their length is left when hidden, 0..1" })
	squashTo: number = 0.25;
	@property({ tooltip: "With squash: how far they shoot out, against their modelled length — past it, they stretch" })
	squashOut: number = 1;
	@property({ tooltip: "Half the side of the square that hurts, around the tile's centre (without useBox)" })
	halfSize: number = 0.3;
	@property({ tooltip: "Hurts in a box in the tile's own axes instead of the square: wall spikes, reaching out in front" })
	useBox: boolean = false;
	@property({ tooltip: "Near corner of the box that hurts, in the tile's axes — where the player's middle may be" })
	boxMin: Vec3 = v3(-0.45, -1, 0);
	@property({ tooltip: "Far corner of the box that hurts, in the tile's axes" })
	boxMax: Vec3 = v3(0.45, 2, 0.45);
	@property({ tooltip: "Seconds into the cycle it starts at, so neighbouring traps can take turns" })
	phase: number = 0;

	private _up = v3();
	private _scale = v3(1, 1, 1);
	private _hide = v3();
	private _time = 0;
	private _hurt = false;
	private _inverse = new Mat4();
	private _local = v3();

	protected onLoad(): void {
		if (this.spikes) {
			this._up.set(this.spikes.position);
			this._scale.set(this.spikes.scale);
		}
		this._hide.set(this.hideDirection);
		this._hide.lengthSqr() > 1e-8 ? this._hide.normalize() : this._hide.set(0, -1, 0);
		this._time = this.phase;
		this._place();
	}

	protected update(dt: number): void {
		this._time += dt;
		const raised = this._place();
		// Up far enough to stab — the player on the tile is hit, once per rise; a zombie the
		// camera sees on it dies.
		if (raised > 0.5) {
			this._stab();
		} else {
			this._hurt = false;
		}
	}

	/** Puts the spikes where the cycle has them; returns how far up they are, 0..1. */
	private _place(): number {
		const cycle = this.closedTime + this.openTime;
		const t = cycle > 0 ? this._time % cycle : 0;
		let raised = 0;
		if (t >= this.closedTime) {
			const up = t - this.closedTime;
			const sinkFrom = this.openTime - this.sinkTime;
			if (up < this.riseTime) {
				raised = up / Math.max(this.riseTime, 1e-4);
			} else if (up > sinkFrom) {
				raised = 1 - (up - sinkFrom) / Math.max(this.sinkTime, 1e-4);
			} else {
				raised = 1;
			}
		}
		raised = Math.max(0, Math.min(1, raised));
		if (this.spikes) {
			if (this.squash) {
				// Along the hiding axis only: from full length to `squashTo` of it, into the wall.
				const k = this.squashTo + (this.squashOut - this.squashTo) * raised;
				const h = this._hide;
				const along = (axis: number) => 1 + (k - 1) * Math.abs(axis);
				this.spikes.setScale(this._scale.x * along(h.x), this._scale.y * along(h.y), this._scale.z * along(h.z));
			} else {
				const back = this.hiddenDepth * (1 - raised);
				this.spikes.setPosition(this._up.x + this._hide.x * back, this._up.y + this._hide.y * back, this._up.z + this._hide.z * back);
			}
		}
		return raised;
	}

	private _stab(): void {
		const at = this.node.worldPosition;
		const player = PlayerAttack.instance;
		if (!this._hurt && player && !player.isDead && this._catches(player.node.worldPosition)) {
			this._hurt = true;
			player.takeHit(this._from(at, player.node.worldPosition));
		}
		for (const zombie of HazardVictims.zombies()) {
			const them = zombie.node.worldPosition;
			this._catches(them) && HazardVictims.kill(zombie, this._from(at, them));
		}
	}

	/** Is a point on the floor in what the spikes hurt? */
	private _catches(them: Vec3): boolean {
		const at = this.node.worldPosition;
		if (this.useBox) {
			Mat4.invert(this._inverse, this.node.worldMatrix);
			const p = Vec3.transformMat4(this._local, them, this._inverse);
			const min = this.boxMin;
			const max = this.boxMax;
			return !(p.x < min.x || p.x > max.x || p.y < min.y || p.y > max.y || p.z < min.z || p.z > max.z);
		}
		return Math.abs(them.x - at.x) <= this.halfSize && Math.abs(them.z - at.z) <= this.halfSize;
	}

	/** Where the splash flies from: away from the wall, or up out of the floor. */
	private _from(at: Vec3, them: Vec3): Vec3 {
		return this.useBox ? new Vec3(at.x, them.y, at.z) : new Vec3(them.x, them.y - 1, them.z);
	}
}
