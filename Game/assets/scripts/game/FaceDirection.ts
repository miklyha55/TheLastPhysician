import { _decorator, Component, math, Node, Quat, v3, Vec2, Vec3 } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

// Turns the node around Y to face the joystick direction on the floor. When the knob is
// released the node keeps the way it was facing. Every turn is at once: a turn played out over
// frames — the hero swinging round half a circle to a chest behind him — reads as dithering.
@ccclass("FaceDirection")
export class FaceDirection extends Component {
	@property({ type: Node, tooltip: "Camera the joystick is relative to; empty — screen up is −Z" })
	camera: Node = null;
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

	private _turn = new Quat();
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

	/** Faces `worldYaw`, degrees around Y in the world — at once: no turning in between. */
	private _turnTo(worldYaw: number): void {
		const parentYaw = this.node.parent ? this.node.parent.eulerAngles.y : 0;
		const euler = this.node.eulerAngles;
		Quat.fromEuler(this._turn, euler.x, worldYaw + this.yawOffset - parentYaw, euler.z);
		this.node.setRotation(this._turn);
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
