import { _decorator, Component, director, Node, Tween, tween, v3 } from "cc";
import GameEvent from "../enums/GameEvent";
import { gameEventTarget } from "../plugins/GameEventTarget";
import { Lever } from "./Lever";
import { PlayerAttack } from "./PlayerAttack";

const { ccclass, property } = _decorator;

// The way out of a level. Shut from the start; only its lever opens it, and flipping the lever
// back shuts it again. A moment after the player reaches the gate while it stands open, the
// next level's scene is loaded — or, with no next scene named, the game is over and
// GameEvent.GAME_COMPLETE goes out.
@ccclass("Gate")
export class Gate extends Component {
	@property({ type: Node, tooltip: "Left leaf, turning on its hinge" })
	leftLeaf: Node = null;
	@property({ type: Node, tooltip: "Right leaf, turning on its hinge" })
	rightLeaf: Node = null;
	@property({ type: Lever, tooltip: "The lever that opens and shuts the gate — the only thing that does" })
	lever: Lever = null;
	@property({ tooltip: "How far each leaf swings open, degrees; the sign picks the side" })
	openAngle: number = 95;
	@property({ tooltip: "Seconds the leaves take to open or shut" })
	openTime: number = 0.6;
	@property({ tooltip: "The player reaches it within this distance of its centre, on the floor" })
	touchRadius: number = 0.6;
	@property({ tooltip: "Seconds from reaching the open gate to leaving the level" })
	delay: number = 1;
	@property({ tooltip: "Scene of the next level; empty — this is the last one" })
	nextScene: string = "";

	private _open = false;
	private _leaving = false;

	protected update(): void {
		if (this._leaving) {
			return;
		}
		if (this.lever && this.lever.isOn !== this._open) {
			this._swing(this.lever.isOn);
		}
		const player = PlayerAttack.instance;
		if (!player || player.isDead) {
			return;
		}
		const at = this.node.worldPosition;
		const them = player.node.worldPosition;
		if (Math.hypot(them.x - at.x, them.z - at.z) > this.touchRadius) {
			return;
		}
		if (!this._open) {
			return; // shut: only the lever opens it
		}
		this._leaving = true;
		this.scheduleOnce(() => this._leave(), this.delay);
	}

	/** Leaves open or shut. They hinge on opposite sides, so they turn opposite ways to swing to one side. */
	private _swing(open: boolean): void {
		this._open = open;
		const angle = open ? this.openAngle : 0;
		for (const [leaf, sign] of [[this.leftLeaf, 1], [this.rightLeaf, -1]] as [Node, number][]) {
			if (!leaf) {
				continue;
			}
			Tween.stopAllByTarget(leaf);
			tween(leaf).to(this.openTime, { eulerAngles: v3(0, angle * sign, 0) }, { easing: "quadOut" }).start();
		}
	}

	private _leave(): void {
		if (this.nextScene) {
			director.loadScene(this.nextScene);
		} else {
			gameEventTarget.emit(GameEvent.GAME_COMPLETE);
		}
	}
}
