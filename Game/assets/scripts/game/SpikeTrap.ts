import { _decorator, Component, Node, v3, Vec3 } from "cc";
import { PlayerAttack } from "./PlayerAttack";

const { ccclass, property } = _decorator;

// Spikes in a floor tile. Hidden under the floor from the start, then round and round for
// good: hidden for `closedTime`, shoot up, stay up for `openTime`, sink back. The player
// standing on the tile while they are up dies.
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
	@property({ tooltip: "Half the side of the square that hurts, around the tile's centre" })
	halfSize: number = 0.3;
	@property({ tooltip: "Seconds into the cycle it starts at, so neighbouring traps can take turns" })
	phase: number = 0;

	private _up = v3();
	private _time = 0;
	private _hurt = false;

	protected onLoad(): void {
		if (this.spikes) {
			this._up.set(this.spikes.position);
		}
		this._time = this.phase;
		this._place();
	}

	protected update(dt: number): void {
		this._time += dt;
		const raised = this._place();
		// Up far enough to stab — the player on the tile dies, once per rise.
		if (raised > 0.5) {
			if (!this._hurt) {
				this._stab();
			}
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
			this.spikes.setPosition(this._up.x, this._up.y - this.hiddenDepth * (1 - raised), this._up.z);
		}
		return raised;
	}

	private _stab(): void {
		const player = PlayerAttack.instance;
		if (!player || player.isDead) {
			return;
		}
		const at = this.node.worldPosition;
		const them = player.node.worldPosition;
		if (Math.abs(them.x - at.x) <= this.halfSize && Math.abs(them.z - at.z) <= this.halfSize) {
			this._hurt = true;
			// From below: the splash flies up out of the floor.
			player.takeHit(new Vec3(them.x, them.y - 1, them.z));
		}
	}
}
