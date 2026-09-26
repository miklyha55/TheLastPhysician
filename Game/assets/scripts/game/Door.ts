import { _decorator, Component, Node, Quat, quat, Tween, tween } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";

const { ccclass, property } = _decorator;

// Swings the door leaf open on GameEvent.DOOR_OPEN and shut on GameEvent.DOOR_CLOSE. An
// event may name the door node it is for; without one it is for every door. The leaf turns
// around its own pivot, which sits on the hinge.
@ccclass("Door")
export class Door extends Component {
	@property(Node) leaf: Node = null;
	@property({ tooltip: "Leaf yaw when open, degrees; the sign picks the side it swings to" })
	openAngle: number = 90;
	@property({ tooltip: "Seconds to open or close; 0 — at once" })
	duration: number = 0.3;
	@property startOpen: boolean = false;

	private _open: boolean = false;
	private _closedRotation: Quat = quat();
	private _openRotation: Quat = quat();

	/** Can the player walk through? True from the moment the door starts opening. */
	get isOpen(): boolean {
		return this._open;
	}

	/** The leaf's rotation when shut, which is how it blocks the doorway. */
	get closedRotation(): Quat {
		return this._closedRotation;
	}

	protected onLoad(): void {
		if (!this.leaf) {
			return;
		}
		this._closedRotation.set(this.leaf.rotation);
		Quat.fromEuler(this._openRotation, 0, this.openAngle, 0);
		Quat.multiply(this._openRotation, this._closedRotation, this._openRotation);
		this._open = this.startOpen;
		this.leaf.setRotation(this._open ? this._openRotation : this._closedRotation);
	}

	protected onEnable() {
		this._handleEvents(true);
	}

	protected onDisable() {
		this._handleEvents(false);
	}

	private _handleEvents(active: boolean) {
		const func: string = active ? "on" : "off";

		gameEventTarget[func](GameEvent.DOOR_OPEN, this.onOpen, this);
		gameEventTarget[func](GameEvent.DOOR_CLOSE, this.onClose, this);
	}

	private onOpen(door?: Node): void {
		if (!door || door === this.node) {
			this.setOpen(true);
		}
	}

	private onClose(door?: Node): void {
		if (!door || door === this.node) {
			this.setOpen(false);
		}
	}

	setOpen(open: boolean): void {
		if (!this.leaf || open === this._open) {
			return;
		}
		this._open = open;
		const target = open ? this._openRotation : this._closedRotation;
		Tween.stopAllByTarget(this.leaf);
		if (this.duration <= 0) {
			this.leaf.setRotation(target);
			return;
		}
		tween(this.leaf).to(this.duration, { rotation: target }).start();
	}
}
