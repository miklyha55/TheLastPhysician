import { _decorator, Component, math, Node, Quat, v3, Vec2, Vec3 } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

// Turns the node around Y to face the joystick direction on the floor. When the knob is
// released the node keeps the way it was facing. Every turn goes by quaternions, the short way
// round, at `turnSpeed`: never the long way, never a jump from one Euler angle to another.
@ccclass("FaceDirection")
export class FaceDirection extends Component {
	@property({ type: Node, tooltip: "Camera the joystick is relative to; empty — screen up is −Z" })
	camera: Node = null;
	@property({ tooltip: "Degrees per second; 0 — turn instantly" })
	turnSpeed: number = 0;
	@property({ tooltip: "Extra yaw if the model's front is not its local +Z" })
	yawOffset: number = 0;

	/** While set, the stick does not turn the node — a throw or a jump turns it itself. Let go,
	 * it turns at once to where the stick is held, not only when the stick next moves. */
	get locked(): boolean {
		return this._locked;
	}
	set locked(value: boolean) {
		this._locked = value;
		!value && this._held.lengthSqr() > 0 && this.onDirection(this._held);
	}

	private _locked = false;
	private _held: Vec2 = new Vec2();

	/** Where it turns to; null — nowhere yet. */
	private _target: Quat = null;
	private _now = new Quat();
	private _forward: Vec3 = v3();
	private _right: Vec3 = v3();
	private _world: Vec3 = v3();

	protected onEnable() {
		this._handleEvents(true);
	}

	protected onDisable() {
		this._handleEvents(false);
	}

	private _handleEvents(active: boolean) {
		const func: string = active ? "on" : "off";

		gameEventTarget[func](GameEvent.MOVE_DIRECTION, this.onDirection, this);
	}

	private onDirection(direction: Vec2): void {
		direction !== this._held && this._held.set(direction);
		if (this._locked || direction.lengthSqr() === 0) {
			return;
		}
		this._axes();
		Vec3.multiplyScalar(this._world, this._right, direction.x);
		Vec3.scaleAndAdd(this._world, this._world, this._forward, direction.y);
		// World yaw that turns local +Z onto the direction, then into the parent's frame.
		this._turnTo(math.toDegree(Math.atan2(this._world.x, this._world.z)));
	}

	/** Turns to face a point on the floor, the way a joystick push towards it would. */
	faceTowards(point: Vec3): void {
		const at = this.node.worldPosition;
		const dx = point.x - at.x;
		const dz = point.z - at.z;
		if (dx * dx + dz * dz < 1e-8) {
			return;
		}
		this._turnTo(math.toDegree(Math.atan2(dx, dz)));
	}

	protected update(dt: number): void {
		if (!this._target || this.turnSpeed <= 0) {
			return;
		}
		// The angle left between the two, the short way (|dot| — q and −q are the same turn).
		const now = this.node.getRotation(this._now);
		const dot = Math.min(1, Math.abs(Quat.dot(now, this._target)));
		const left = math.toDegree(2 * Math.acos(dot));
		const step = this.turnSpeed * dt;
		if (left <= step || left < 1e-3) {
			this.node.setRotation(this._target);
			return;
		}
		// slerp goes the short way round of itself.
		Quat.slerp(now, now, this._target, step / left);
		this.node.setRotation(now);
	}

	/** To face `worldYaw`, degrees around Y in the world: its rotation in the parent's frame, and there at once with no turn speed. */
	private _turnTo(worldYaw: number): void {
		const parentYaw = this.node.parent ? this.node.parent.eulerAngles.y : 0;
		const euler = this.node.eulerAngles;
		this._target = this._target || new Quat();
		Quat.fromEuler(this._target, euler.x, worldYaw + this.yawOffset - parentYaw, euler.z);
		if (this.turnSpeed <= 0) {
			this.node.setRotation(this._target);
		}
	}

	// The camera's forward and right flattened onto the floor.
	private _axes(): void {
		if (!this.camera) {
			this._forward.set(0, 0, -1);
			this._right.set(1, 0, 0);
			return;
		}
		Vec3.transformQuat(this._forward, Vec3.FORWARD, this.camera.worldRotation);
		this._forward.y = 0;
		this._forward.normalize();
		Vec3.cross(this._right, this._forward, Vec3.UP);
		this._right.normalize();
	}
}
