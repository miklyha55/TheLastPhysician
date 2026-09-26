import { _decorator, Component, Node, Quat, quat, Tween, tween } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";
import { PlayerAttack } from "./PlayerAttack";

const { ccclass, property } = _decorator;

// Swings the door leaf open on GameEvent.DOOR_OPEN and shut on GameEvent.DOOR_CLOSE. An
// event may name the door node it is for; without one it is for every door. The leaf turns
// around its own pivot, which sits on the hinge. A floor button (FloorButton) holds it open
// while pressed; `closeDelay` seconds after the button comes up the door shuts — waiting,
// though, for the player to be out of the doorway.
@ccclass("Door")
export class Door extends Component {
	@property(Node) leaf: Node = null;
	@property({ tooltip: "Leaf yaw when open, degrees; the sign picks the side it swings to" })
	openAngle: number = 90;
	@property({ tooltip: "Seconds to open or close; 0 — at once" })
	duration: number = 0.3;
	@property startOpen: boolean = false;
	@property({ tooltip: "Seconds from the button coming up to the door shutting" })
	closeDelay: number = 0.5;
	@property({ tooltip: "It does not shut on the player standing this close to its centre, on the floor" })
	clearRadius: number = 0.45;

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

	private _held = 0;
	private _releasedFor = -1;

	/** A button pressing (true) or letting go (false). Open while any holds it. */
	hold(down: boolean): void {
		this._held = Math.max(0, this._held + (down ? 1 : -1));
		if (this._held > 0) {
			this._releasedFor = -1;
			this.setOpen(true);
		} else {
			this._releasedFor = 0;
		}
	}

	protected update(dt: number): void {
		if (this._releasedFor < 0) {
			return;
		}
		this._releasedFor += dt;
		if (this._releasedFor >= this.closeDelay && !this._inDoorway()) {
			this._releasedFor = -1;
			this.setOpen(false);
		}
	}

	private _inDoorway(): boolean {
		const player = PlayerAttack.instance;
		if (!player || player.isDead) {
			return false;
		}
		const at = this.node.worldPosition;
		const them = player.node.worldPosition;
		return Math.hypot(them.x - at.x, them.z - at.z) <= this.clearRadius;
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
