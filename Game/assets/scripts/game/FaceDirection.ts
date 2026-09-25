import { _decorator, Component, math, Node, v3, Vec2, Vec3 } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

// Turns the node around Y to face the joystick direction on the floor. When the knob is
// released the node keeps the way it was facing.
@ccclass("FaceDirection")
export class FaceDirection extends Component {
	@property({ type: Node, tooltip: "Camera the joystick is relative to; empty — screen up is −Z" })
	camera: Node = null;
	@property({ tooltip: "Degrees per second; 0 — turn instantly" })
	turnSpeed: number = 0;
	@property({ tooltip: "Extra yaw if the model's front is not its local +Z" })
	yawOffset: number = 0;

	private _targetYaw: number = null;
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
		if (direction.lengthSqr() === 0) {
			return;
		}
		this._axes();
		Vec3.multiplyScalar(this._world, this._right, direction.x);
		Vec3.scaleAndAdd(this._world, this._world, this._forward, direction.y);
		// World yaw that turns local +Z onto the direction, then into the parent's frame.
		const worldYaw = math.toDegree(Math.atan2(this._world.x, this._world.z)) + this.yawOffset;
		const parentYaw = this.node.parent ? this.node.parent.eulerAngles.y : 0;
		this._targetYaw = worldYaw - parentYaw;
		if (this.turnSpeed <= 0) {
			this._setYaw(this._targetYaw);
		}
	}

	protected update(dt: number): void {
		if (this._targetYaw === null || this.turnSpeed <= 0) {
			return;
		}
		const current = this.node.eulerAngles.y;
		const delta = ((this._targetYaw - current + 540) % 360) - 180;
		const step = this.turnSpeed * dt;
		this._setYaw(Math.abs(delta) <= step ? this._targetYaw : current + Math.sign(delta) * step);
	}

	private _setYaw(yaw: number): void {
		const euler = this.node.eulerAngles;
		this.node.setRotationFromEuler(euler.x, yaw, euler.z);
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
