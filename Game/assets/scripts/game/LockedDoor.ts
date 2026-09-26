import { _decorator, Component } from "cc";
import KeyColor from "../enums/KeyColor";
import { Door } from "./Door";
import { PlayerKeys } from "./PlayerKeys";

const { ccclass, property } = _decorator;

// A door of a colour: shut until the player comes up to it carrying the key of that colour,
// then it swings open and stays open. Without the key it is a wall.
@ccclass("LockedDoor")
export class LockedDoor extends Component {
	@property({ type: KeyColor }) color: number = KeyColor.Red;
	@property({ tooltip: "The door opens when the player with the key is this close" })
	openDistance: number = 1;

	private _door: Door = null;

	protected start(): void {
		this._door = this.getComponent(Door);
	}

	protected update(): void {
		const keys = PlayerKeys.instance;
		if (!this._door || this._door.isOpen || !keys || !keys.has(this.color)) {
			return;
		}
		const at = this.node.worldPosition;
		const player = keys.node.worldPosition;
		if (Math.hypot(player.x - at.x, player.z - at.z) <= this.openDistance) {
			this._door.setOpen(true);
		}
	}
}
