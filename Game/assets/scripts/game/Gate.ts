import { _decorator, Component, director, Node, tween, v3 } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";
import { PlayerAttack } from "./PlayerAttack";

const { ccclass, property } = _decorator;

// The way out of a level. Shut from the start; when the player comes up to it, both leaves
// swing open, and a moment later the next level's scene is loaded — or, with no next scene
// named, the game is over and GameEvent.GAME_COMPLETE goes out.
@ccclass("Gate")
export class Gate extends Component {
	@property({ type: Node, tooltip: "Left leaf, turning on its hinge" })
	leftLeaf: Node = null;
	@property({ type: Node, tooltip: "Right leaf, turning on its hinge" })
	rightLeaf: Node = null;
	@property({ tooltip: "How far each leaf swings open, degrees; the sign picks the side" })
	openAngle: number = 95;
	@property({ tooltip: "Seconds the leaves take to open" })
	openTime: number = 0.6;
	@property({ tooltip: "The player opens it within this distance of its centre, on the floor" })
	touchRadius: number = 0.6;
	@property({ tooltip: "Seconds from the touch to leaving the level" })
	delay: number = 1;
	@property({ tooltip: "Scene of the next level; empty — this is the last one" })
	nextScene: string = "";

	private _opened = false;

	protected update(): void {
		if (this._opened) {
			return;
		}
		const player = PlayerAttack.instance;
		if (!player || player.isDead) {
			return;
		}
		const at = this.node.worldPosition;
		const them = player.node.worldPosition;
		if (Math.hypot(them.x - at.x, them.z - at.z) <= this.touchRadius) {
			this._open();
		}
	}

	private _open(): void {
		this._opened = true;
		// The leaves hinge on opposite sides, so they turn opposite ways to swing to one side.
		this.leftLeaf && tween(this.leftLeaf).to(this.openTime, { eulerAngles: v3(0, this.openAngle, 0) }, { easing: "quadOut" }).start();
		this.rightLeaf && tween(this.rightLeaf).to(this.openTime, { eulerAngles: v3(0, -this.openAngle, 0) }, { easing: "quadOut" }).start();
		this.scheduleOnce(() => this._leave(), this.delay);
	}

	private _leave(): void {
		if (this.nextScene) {
			director.loadScene(this.nextScene);
		} else {
			gameEventTarget.emit(GameEvent.GAME_COMPLETE);
		}
	}
}
