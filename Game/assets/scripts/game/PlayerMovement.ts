import { _decorator, Component, Node, v3, Vec2, Vec3 } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

// Moves the player over the floor at a constant linear speed along the joystick direction,
// however far the knob is pushed. Screen up is away from the camera.
@ccclass("PlayerMovement")
export class PlayerMovement extends Component {
	@property({ tooltip: "Units per second" })
	speed: number = 2;
	@property({ type: Node, tooltip: "Camera the joystick is relative to; empty — screen up is −Z" })
	camera: Node = null;

	private _direction: Vec2 = new Vec2();
	private _velocity: Vec3 = v3();
	private _forward: Vec3 = v3();
	private _right: Vec3 = v3();

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

	// Only the way the knob points matters; how far it is pushed does not change the speed.
	private onDirection(direction: Vec2): void {
		this._direction.set(direction);
		if (this._direction.lengthSqr() > 0) {
			this._direction.normalize();
		}
	}

	protected update(dt: number): void {
		if (this._direction.lengthSqr() === 0) {
			return;
		}
		this._axes();
		Vec3.multiplyScalar(this._velocity, this._right, this._direction.x);
		Vec3.scaleAndAdd(this._velocity, this._velocity, this._forward, this._direction.y);
		Vec3.scaleAndAdd(this._velocity, this.node.worldPosition, this._velocity, this.speed * dt);
		this.node.setWorldPosition(this._velocity);
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
