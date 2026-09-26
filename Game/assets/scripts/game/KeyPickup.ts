import { _decorator, Component, Node, tween, v3, Vec3 } from "cc";
import KeyColor from "../enums/KeyColor";
import { PlayerAttack } from "./PlayerAttack";
import { PlayerKeys } from "./PlayerKeys";
import { PotionStack } from "./PotionStack";

const { ccclass, property } = _decorator;

// A key lying about the level: it hovers above the floor, turns slowly and bobs, so it is seen
// from afar. The player picks it up by walking into it: it counts as theirs at once and flies
// in an arc onto the stack on their back, where it waits for a door of its colour.
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
	@property({ tooltip: "Seconds the pop takes when there is no stack to fly to" })
	popTime: number = 0.25;
	@property({ tooltip: "Speed of the flight to the stack on the back, units per second" })
	flySpeed: number = 3;
	@property({ tooltip: "How high the flight to the stack arcs" })
	flyArc: number = 0.4;

	private _time = Math.random() * 10;
	private _taken = false;
	private _euler = v3();
	private _flying = false;
	private _flight = 0;
	private _stack: PotionStack = null;
	private _start = v3();
	private _to = v3();
	private _at = v3();

	protected update(dt: number): void {
		if (this._flying) {
			this._fly(dt);
			return;
		}
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
		// Theirs from now on, whatever the key is doing in the air.
		keys.add(this.color);
		const stack = PlayerAttack.instance && PlayerAttack.instance.stack;
		if (stack && this.visual) {
			// Off to the stack on the back, in an arc, turning over on the way.
			this._stack = stack;
			this._start.set(this.visual.worldPosition);
			this._flying = true;
			this._flight = 0;
			return;
		}
		const target = this.visual || this.node;
		const up = target.position.clone().add(v3(0, 0.15, 0));
		const start = target.scale.clone();
		// No stack to go to: a quick pop up and away, then the node is freed.
		tween(target)
			.to(this.popTime * 0.4, { position: up, scale: Vec3.multiplyScalar(v3(), start, 1.4) })
			.to(this.popTime * 0.6, { scale: v3() })
			.call(() => this.node.destroy())
			.start();
	}

	private _fly(dt: number): void {
		const stack = this._stack;
		if (!stack || !stack.isValid || !this.visual) {
			this.node.destroy();
			return;
		}
		stack.nextSlot(this._to);
		const distance = Math.hypot(this._to.x - this._start.x, this._to.z - this._start.z);
		const duration = Math.max(0.2, distance / Math.max(this.flySpeed, 0.01));
		this._flight += dt;
		const t = Math.min(1, this._flight / duration);
		if (t >= 1) {
			// Into the stack for good; the pickup it came from is not needed any more.
			stack.pushKey(this.visual, this.color);
			this.visual = null;
			this._flying = false;
			this.node.destroy();
			return;
		}
		Vec3.lerp(this._at, this._start, this._to, t);
		this._at.y += this.flyArc * 4 * t * (1 - t);
		this.visual.setWorldPosition(this._at);
		this.visual.setRotationFromEuler(this._euler.set(t * 90, this._time * this.spinSpeed + t * 360, 0));
	}
}
