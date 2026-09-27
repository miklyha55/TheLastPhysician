import { _decorator, Component, director, instantiate, Node, Prefab, UITransform, v3 } from "cc";
import { PinUiToWorld } from "../auxiliaryComponents/PinUiToWorld";
import { ProgressBar } from "../auxiliaryComponents/ProgressBar";
import { CameraManager } from "../managers/camera/CameraManager";
import { Zombie } from "./Zombie";

const { ccclass, property } = _decorator;

/** Where the enemies' bars live on the Canvas: under the rest of the UI. */
const HOLDER = "EnemyBars";

// A zombie's lives over its head: an EnemyProgressBar on the Canvas, pinned above the zombie
// (PinUiToWorld). It shows up at the first hit, full, and shortens at once to what is left; its
// bar (ProgressBar's Active) goes on shortening with every life the zombie loses — to a potion,
// a burst, a blast — and it is gone when the zombie falls. On every enemy prefab.
@ccclass("EnemyBar")
export class EnemyBar extends Component {
	@property({ type: Prefab, tooltip: "The bar: EnemyProgressBar" })
	bar: Prefab = null;
	@property({ tooltip: "Height above the zombie's feet the bar hangs at" })
	height: number = 0.9;
	@property({ tooltip: "Seconds the bar takes to shrink after a hit" })
	shrinkTime: number = 0.2;

	private _zombie: Zombie = null;
	private _node: Node = null;
	private _progress: ProgressBar = null;
	private _full = 1;
	private _shown = -1;

	protected start(): void {
		this._zombie = this.getComponent(Zombie);
		this._full = this._zombie ? Math.max(1, this._zombie.lives) : 1;
	}

	protected update(): void {
		if (!this._zombie) {
			return;
		}
		if (this._zombie.isDead) {
			this._remove();
			this.enabled = false;
			return;
		}
		if (!this._node) {
			// Not there until the first hit.
			if (this._zombie.lives >= this._full || !this._spawn()) {
				return;
			}
		}
		this._show(this.shrinkTime);
	}

	/** The bar over its head, full — it shrinks to what is left right after. False when it cannot be made. */
	private _spawn(): boolean {
		const holder = this._holder();
		const cameras = CameraManager.instance;
		if (!this.bar || !holder || !cameras) {
			return false;
		}
		const node = instantiate(this.bar);
		const pin = node.getComponent(PinUiToWorld);
		if (pin) {
			pin.worldNode = this.node;
			pin.cameraWorld = cameras.cameras[0];
			pin.cameraUi = cameras.uiCamera;
			pin.offset = v3(0, this.height, 0);
		}
		holder.addChild(node);
		this._node = node;
		this._progress = node.getComponent(ProgressBar);
		this._shown = this._full;
		this._progress && this._progress.onSetProgressValue(1, 0);
		return true;
	}

	protected onDestroy(): void {
		this._remove();
	}

	/** As many lives as it has left, of those it started with. */
	private _show(time: number): void {
		const lives = Math.max(0, this._zombie.lives);
		if (lives === this._shown || !this._progress) {
			return;
		}
		this._shown = lives;
		this._progress.onSetProgressValue(lives / this._full, time);
	}

	private _remove(): void {
		this._node && this._node.isValid && this._node.destroy();
		this._node = null;
	}

	/** One holder on the Canvas for every bar, first among its children so the rest of the UI stays on top. */
	private _holder(): Node {
		const canvas = director.getScene() && director.getScene().getChildByName("Canvas");
		if (!canvas) {
			return null;
		}
		let holder = canvas.getChildByName(HOLDER);
		if (!holder) {
			holder = new Node(HOLDER);
			holder.layer = canvas.layer;
			holder.addComponent(UITransform);
			canvas.addChild(holder);
			holder.setSiblingIndex(1); // over the UI camera's node, under the rest
		}
		return holder;
	}
}
