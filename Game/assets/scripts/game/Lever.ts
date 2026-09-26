import { _decorator, Component, Node, Tween, tween, v3 } from "cc";
import { PlayerAttack } from "./PlayerAttack";

const { ccclass, property } = _decorator;

// A lever on a floor tile. The player bumps into it — it is solid (WallCollision's
// solidPrefabs) — and it flips: on, then off at the next bump, and so on. A bump counts once:
// to flip it again the player steps away and comes back. What it drives watches `isOn` —
// a gate opens and shuts with it.
@ccclass("Lever")
export class Lever extends Component {
	@property({ type: Node, tooltip: "The handle, turning on its pivot around Z" })
	handle: Node = null;
	@property({ tooltip: "Handle angle when off, degrees around Z" })
	offAngle: number = 40;
	@property({ tooltip: "Handle angle when on, degrees around Z" })
	onAngle: number = -40;
	@property({ tooltip: "Seconds the handle takes to swing over" })
	swingTime: number = 0.25;
	@property({ tooltip: "The player touches it this close to its centre, on the floor" })
	touchRadius: number = 0.5;
	@property({ tooltip: "How much further the player has to step away before the next bump counts" })
	releaseMargin: number = 0.15;
	@property startOn: boolean = false;

	private _on = false;
	private _touching = false;

	get isOn(): boolean {
		return this._on;
	}

	protected onLoad(): void {
		this._on = this.startOn;
		this.handle && this.handle.setRotationFromEuler(0, 0, this._on ? this.onAngle : this.offAngle);
	}

	protected update(): void {
		const player = PlayerAttack.instance;
		if (!player || player.isDead) {
			return;
		}
		const at = this.node.worldPosition;
		const them = player.node.worldPosition;
		const distance = Math.hypot(them.x - at.x, them.z - at.z);
		if (!this._touching && distance <= this.touchRadius) {
			this._touching = true;
			this.flip();
		} else if (this._touching && distance > this.touchRadius + this.releaseMargin) {
			this._touching = false;
		}
	}

	/** Over to the other side. */
	flip(): void {
		this._on = !this._on;
		if (!this.handle) {
			return;
		}
		Tween.stopAllByTarget(this.handle);
		tween(this.handle)
			.to(this.swingTime, { eulerAngles: v3(0, 0, this._on ? this.onAngle : this.offAngle) }, { easing: "backOut" })
			.start();
	}
}
