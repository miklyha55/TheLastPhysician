import { _decorator, Component, Node, v3, Vec2, Vec3 } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";
import { SlimeStream } from "./SlimeStream";
import { WallCollision } from "./WallCollision";

const { ccclass, property } = _decorator;

// Moves the player over the floor at a constant linear speed along the joystick direction,
// however far the knob is pushed. Screen up is away from the camera. Wading through the slime
// of a stream (SlimeStream) it goes slower, and as soon as it is out, at its own speed again.
@ccclass("PlayerMovement")
export class PlayerMovement extends Component {
	@property({ tooltip: "Units per second" })
	speed: number = 2;
	@property({ type: Node, tooltip: "Camera the joystick is relative to; empty — screen up is −Z" })
	camera: Node = null;
	@property({ tooltip: "Share of the speed left while wading through slime" })
	slimeSpeed: number = 0.5;
	@property({ tooltip: "Radius of the player's body touching the slime" })
	slimeRadius: number = 0.1;

	private _direction: Vec2 = new Vec2();
	private _velocity: Vec3 = v3();
	private _forward: Vec3 = v3();
	private _right: Vec3 = v3();
	private _target: Vec3 = v3();
	private _walls: WallCollision = null;

	/** While set, the player is moved by something else — a throw, a jump — and the stick is ignored. */
	locked = false;

	/** Is the player touching the slime of a stream? */
	get inSlime(): boolean {
		const at = this.node.worldPosition;
		return SlimeStream.touching(at.x, at.z, this.slimeRadius);
	}

	protected start(): void {
		this._walls = this.getComponent(WallCollision);
	}

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

	/** Where the stick sends the player, flat on the floor and of unit length; false when it is let go. */
	moveDirection(out: Vec3): boolean {
		if (this._direction.lengthSqr() === 0) {
			return false;
		}
		this._axes();
		Vec3.multiplyScalar(out, this._right, this._direction.x);
		Vec3.scaleAndAdd(out, out, this._forward, this._direction.y);
		out.y = 0;
		out.normalize();
		return true;
	}

	protected update(dt: number): void {
		if (this.locked || this._direction.lengthSqr() === 0) {
			return;
		}
		this._axes();
		Vec3.multiplyScalar(this._velocity, this._right, this._direction.x);
		Vec3.scaleAndAdd(this._velocity, this._velocity, this._forward, this._direction.y);
		Vec3.scaleAndAdd(this._target, this.node.worldPosition, this._velocity, this.speed * (this.inSlime ? this.slimeSpeed : 1) * dt);
		// Walls are settled before the move, so nothing that follows the player sees it inside one.
		if (this._walls) {
			this._walls.resolve(this.node.worldPosition, this._target, this._target);
		}
		this.node.setWorldPosition(this._target);
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
