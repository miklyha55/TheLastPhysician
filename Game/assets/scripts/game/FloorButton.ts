import { _decorator, Component, Node, Tween, tween, v3, Vec3 } from "cc";
import { Debris } from "./Debris";
import { Door } from "./Door";
import { PlayerAttack } from "./PlayerAttack";

const { ccclass, property } = _decorator;

// A button in a floor tile. Whatever stands on it holds it down: the player stepping on it,
// or a small piece of furniture lying on it — thrown there, kicked there, anything loose
// (Debris). With nothing on it any more it springs back up. Its doors open when it goes down
// and shut a while after it comes up (Door.closeDelay).
@ccclass("FloorButton")
export class FloorButton extends Component {
	@property({ type: [Door], tooltip: "Doors it opens" })
	doors: Door[] = [];
	@property({ type: Node, tooltip: "The button, sinking into the tile when pressed" })
	plate: Node = null;
	@property({ tooltip: "How far the button sinks when pressed" })
	pressDepth: number = 0.025;
	@property({ tooltip: "Seconds it takes to sink" })
	pressTime: number = 0.08;
	@property({ tooltip: "Seconds it takes to spring back" })
	releaseTime: number = 0.2;
	@property({ tooltip: "Something standing this close to its centre, on the floor, presses it" })
	radius: number = 0.3;
	@property({ tooltip: "Something higher above the floor than this — in a jump, in flight — does not press it" })
	maxHeight: number = 0.15;

	private _down = false;
	private _up = v3();

	/** Is something holding it down? */
	get isDown(): boolean {
		return this._down;
	}

	protected onLoad(): void {
		this.plate && this._up.set(this.plate.position);
	}

	protected update(): void {
		const down = this._pressed();
		if (down !== this._down) {
			this._down = down;
			this._move(down);
			for (const door of this.doors) {
				door && door.hold(down);
			}
		}
	}

	/** Anyone on it: the player, alive, or a small piece of furniture lying loose. */
	private _pressed(): boolean {
		const player = PlayerAttack.instance;
		if (player && !player.isDead && this._on(player.node.worldPosition)) {
			return true;
		}
		const debris = Debris.instance;
		if (debris) {
			for (const body of debris.bodies) {
				if (!body.held && body.node.isValid && this._on(body.node.worldPosition, body.radius)) {
					return true;
				}
			}
		}
		return false;
	}

	/** Standing on it; `lift` is how far above its base the point is — a loose thing is held at its middle. */
	private _on(point: Vec3, lift: number = 0): boolean {
		const at = this.node.worldPosition;
		return point.y - at.y <= this.maxHeight + lift && Math.hypot(point.x - at.x, point.z - at.z) <= this.radius;
	}

	private _move(down: boolean): void {
		if (!this.plate) {
			return;
		}
		Tween.stopAllByTarget(this.plate);
		const to = v3(this._up.x, this._up.y - (down ? this.pressDepth : 0), this._up.z);
		tween(this.plate)
			.to(down ? this.pressTime : this.releaseTime, { position: to }, { easing: down ? "quadOut" : "backOut" })
			.start();
	}
}
