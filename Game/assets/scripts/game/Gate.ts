import { _decorator, Component, Mat4, Node, Tween, tween, v3, Vec3 } from "cc";
import { GameState } from "../managers/GameState";
import { Lever } from "./Lever";
import { PlayerAttack } from "./PlayerAttack";

const { ccclass, property } = _decorator;

// The way out of a level. Shut from the start; only its lever opens it, and flipping the lever
// back shuts it again. Behind it, outside the level, lies the exit — a box the player walks
// into through the open gate. The moment they step into it the gate swings shut behind them,
// and a moment later the level is done: GameState takes what the player carries on to the next level — or, after the
// last one, ends the game.
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
	@property({ type: Node, tooltip: "The exit behind the gate: the box around this node, in its own axes, that leads out of the level" })
	exit: Node = null;
	@property({ tooltip: "Size of the exit box — across, height, depth" })
	exitSize: Vec3 = v3(0.8, 2, 0.6);
	@property({ tooltip: "Seconds from reaching the open gate to leaving the level" })
	delay: number = 1;

	private _open = false;
	private _leaving = false;
	private _inverse = new Mat4();
	private _local = v3();

	/** Can the player walk through? True from the moment the leaves start swinging open. */
	get isOpen(): boolean {
		return this._open;
	}

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
		if (!this._open || !this._inside(player.node.worldPosition)) {
			return; // shut, the way out is barred: only the lever opens it
		}
		this._leaving = true;
		console.log("Gate: the player is out");
		// Shut behind them: the level is over, the lever no longer has a say.
		this._swing(false);
		this.scheduleOnce(() => this._leave(), this.delay);
	}

	/** Is a point in the exit box? */
	private _inside(point: Vec3): boolean {
		if (!this.exit) {
			return false;
		}
		Mat4.invert(this._inverse, this.exit.worldMatrix);
		Vec3.transformMat4(this._local, point, this._inverse);
		const scale = this.exit.worldScale;
		return (
			Math.abs(this._local.x * scale.x) <= this.exitSize.x / 2 &&
			Math.abs(this._local.y * scale.y) <= this.exitSize.y / 2 &&
			Math.abs(this._local.z * scale.z) <= this.exitSize.z / 2
		);
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
		const player = PlayerAttack.instance;
		GameState.complete(player ? player.carried() : []);
	}
}
