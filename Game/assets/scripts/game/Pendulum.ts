import { _decorator, Component, Mat4, MeshRenderer, Node, v3, Vec3 } from "cc";
import { HazardVictims } from "./HazardVictims";
import { PlayerAttack } from "./PlayerAttack";

const { ccclass, property } = _decorator;

const _inverse = new Mat4();
const _point = v3();
const _local = v3();

// A pendulum over a floor tile: a blade on an arm, hung from the frame, swinging to and fro
// for good — a sine, `amplitude` either way, a full swing there and back every `period`
// seconds. The player it touches dies: points up their body are taken into the arm's own
// axes and tested against the arm's mesh, grown by the player's radius — so whatever way it
// swings, it is the blade itself that kills.
@ccclass("Pendulum")
export class Pendulum extends Component {
	@property({ type: Node, tooltip: "The arm with the blade, turning on its pivot around its local Z" })
	arm: Node = null;
	@property({ tooltip: "How far it swings either way, degrees" })
	amplitude: number = 55;
	@property({ tooltip: "Seconds for a full swing there and back" })
	period: number = 2.2;
	@property({ tooltip: "Seconds into the swing it starts at, so neighbouring pendulums swing out of step" })
	phase: number = 0;
	@property({ tooltip: "The player's radius: how close to the blade counts as touching it" })
	playerRadius: number = 0.2;
	@property({ tooltip: "Heights up the player's body, above their feet, tested against the blade" })
	bodyHeights: number[] = [0.15, 0.4, 0.7];

	private _time = 0;
	private _min = v3();
	private _max = v3();
	private _measured = false;

	protected onLoad(): void {
		this._time = this.phase;
		this._swing();
	}

	protected update(dt: number): void {
		this._time += dt;
		this._swing();
		this._strike();
	}

	private _swing(): void {
		if (!this.arm) {
			return;
		}
		const angle = this.amplitude * Math.sin((this._time / Math.max(this.period, 0.01)) * Math.PI * 2);
		this.arm.setRotationFromEuler(0, 0, angle);
	}

	/** The player touching the blade dies — and so does a zombie the camera sees. */
	private _strike(): void {
		if (!this.arm || !this._measure()) {
			return;
		}
		Mat4.invert(_inverse, this.arm.worldMatrix);
		const player = PlayerAttack.instance;
		if (player && !player.isDead && this._touches(player.node.worldPosition, this.playerRadius)) {
			player.kill(this.arm.worldPosition);
		}
		for (const zombie of HazardVictims.zombies()) {
			if (this._touches(zombie.node.worldPosition, zombie.radius)) {
				HazardVictims.kill(zombie, this.arm.worldPosition);
			}
		}
	}

	/** Does a body standing at `feet`, of `radius`, touch the blade? `_inverse` holds the arm's inverse. */
	private _touches(feet: Vec3, radius: number): boolean {
		const scale = this.arm.worldScale;
		// The radius in the arm's own units, per axis.
		const rx = radius / Math.max(Math.abs(scale.x), 1e-4);
		const ry = radius / Math.max(Math.abs(scale.y), 1e-4);
		const rz = radius / Math.max(Math.abs(scale.z), 1e-4);
		for (const height of this.bodyHeights) {
			_point.set(feet.x, feet.y + height, feet.z);
			const p = Vec3.transformMat4(_local, _point, _inverse);
			if (
				p.x >= this._min.x - rx && p.x <= this._max.x + rx &&
				p.y >= this._min.y - ry && p.y <= this._max.y + ry &&
				p.z >= this._min.z - rz && p.z <= this._max.z + rz
			) {
				return true;
			}
		}
		return false;
	}

	/** The arm's box in its own axes, from its mesh. */
	private _measure(): boolean {
		if (this._measured) {
			return true;
		}
		const renderer = this.arm.getComponent(MeshRenderer) || this.arm.getComponentInChildren(MeshRenderer);
		const struct = renderer && renderer.mesh && renderer.mesh.struct;
		if (!struct || !struct.minPosition || !struct.maxPosition) {
			return false;
		}
		this._min.set(struct.minPosition);
		this._max.set(struct.maxPosition);
		this._measured = true;
		return true;
	}
}
