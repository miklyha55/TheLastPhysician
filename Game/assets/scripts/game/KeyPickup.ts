import { _decorator, Component, Node, tween, v3, Vec3 } from "cc";
import KeyColor from "../enums/KeyColor";
import { PlayerAttack } from "./PlayerAttack";
import { PlayerKeys } from "./PlayerKeys";

const { ccclass, property } = _decorator;

// A key lying about the level: it hovers above the floor, turns slowly and bobs, so it is seen
// from afar. The player picks it up by walking into it; it pops and is gone, and the player
// carries its colour from then on.
@ccclass("KeyPickup")
export class KeyPickup extends Component {
	@property({ type: KeyColor }) color: number = KeyColor.Red;
	@property({ type: Node, tooltip: "What hovers and turns — the key's mesh" })
	visual: Node = null;
	@property({ tooltip: "Height above the floor it hovers at" })
	height: number = 0.3;
	@property({ tooltip: "How far up and down it bobs" })
	bob: number = 0.05;
	@property({ tooltip: "Bobs per second" })
	bobSpeed: number = 0.8;
	@property({ tooltip: "Degrees per second it turns" })
	spinSpeed: number = 90;
	@property({ tooltip: "The player picks it up within this distance on the floor" })
	pickupRadius: number = 0.35;
	@property({ tooltip: "Seconds the pop takes" })
	popTime: number = 0.25;

	private _time = Math.random() * 10;
	private _taken = false;
	private _euler = v3();

	protected update(dt: number): void {
		if (this._taken) {
			return;
		}
		this._time += dt;
		if (this.visual) {
			this.visual.setPosition(0, this.height + Math.sin(this._time * this.bobSpeed * Math.PI * 2) * this.bob, 0);
			this.visual.setRotationFromEuler(this._euler.set(0, this._time * this.spinSpeed, 0));
		}
		const keys = PlayerKeys.instance;
		const attack = PlayerAttack.instance;
		if (!keys || (attack && attack.isDead)) {
			return;
		}
		const at = this.node.worldPosition;
		const player = keys.node.worldPosition;
		if (Math.hypot(player.x - at.x, player.z - at.z) <= this.pickupRadius) {
			this._take(keys);
		}
	}

	private _take(keys: PlayerKeys): void {
		this._taken = true;
		keys.add(this.color);
		const target = this.visual || this.node;
		const up = target.position.clone().add(v3(0, 0.15, 0));
		const start = target.scale.clone();
		// A quick pop up and away, then the node is freed.
		tween(target)
			.to(this.popTime * 0.4, { position: up, scale: Vec3.multiplyScalar(v3(), start, 1.4) })
			.to(this.popTime * 0.6, { scale: v3() })
			.call(() => this.node.destroy())
			.start();
	}
}
