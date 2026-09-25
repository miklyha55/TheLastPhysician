import { _decorator, Component, Node, Touch, UITransform, v2, v3, Vec2, Vec3 } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

// Appears under the finger when it touches the screen, hides when it lifts. The knob's offset
// from the centre, scaled to 0..1 by the radius, is the direction of movement.
@ccclass("Joystic")
export class Joystic extends Component {
	@property(Node) plate: Node = null;
	@property(Node) draggable: Node = null;
	@property({ tooltip: "Max knob offset from the centre, px. 0 — half the plate width" })
	radius: number = 0;

	private _direction: Vec2 = v2();
	private _touchLocal: Vec3 = v3();

	protected onEnable() {
		this._handleEvents(true);
	}

	protected onDisable() {
		this._handleEvents(false);
	}

	protected start(): void {
		this._setVisible(false);
	}

	private _handleEvents(active: boolean) {
		const func: string = active ? "on" : "off";

		gameEventTarget[func](GameEvent.JOYSTICK_DOWN, this.onDown, this);
		gameEventTarget[func](GameEvent.JOYSTICK_MOVE, this.onMove, this);
		gameEventTarget[func](GameEvent.JOYSTICK_UP, this.onUp, this);
	}

	private onDown(touch: Touch): void {
		this.node.setPosition(this._toParentSpace(touch));
		this.draggable.setPosition(Vec3.ZERO);
		this._setVisible(true);
		this._emitDirection(0, 0);
	}

	private onMove(touch: Touch): void {
		const local = this._toParentSpace(touch).subtract(this.node.position);
		const radius = this._radius();
		const length = Math.hypot(local.x, local.y);
		if (length > radius && length > 0) {
			local.multiplyScalar(radius / length);
		}
		this.draggable.setPosition(local.x, local.y, 0);
		this._emitDirection(local.x / radius, local.y / radius);
	}

	private onUp(): void {
		this.draggable.setPosition(Vec3.ZERO);
		this._setVisible(false);
		this._emitDirection(0, 0);
	}

	private _emitDirection(x: number, y: number): void {
		this._direction.set(x, y);
		gameEventTarget.emit(GameEvent.MOVE_DIRECTION, this._direction);
	}

	private _toParentSpace(touch: Touch): Vec3 {
		const location = touch.getUILocation();
		this._touchLocal.set(location.x, location.y, 0);
		return this.node.parent.getComponent(UITransform).convertToNodeSpaceAR(this._touchLocal, v3());
	}

	private _radius(): number {
		if (this.radius > 0) {
			return this.radius;
		}
		const transform = this.plate && this.plate.getComponent(UITransform);
		return transform ? transform.width / 2 : 100;
	}

	private _setVisible(visible: boolean): void {
		this.plate && (this.plate.active = visible);
		this.draggable && (this.draggable.active = visible);
	}
}
