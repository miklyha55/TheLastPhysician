import { _decorator, Component, Node, SkeletalAnimation, v3, Vec3 } from "cc";
import { Sfx } from "../managers/audio/Sfx";
import { PlayerMovement } from "./PlayerMovement";

const { ccclass, property } = _decorator;

interface Foot {
	node: Node;
	/** Height over the player's feet last frame, and the frame before. */
	last: number;
	falling: boolean;
	/** The lowest and highest it has been of late: where its ground is. */
	low: number;
	high: number;
	/** Seconds since its last step. */
	since: number;
}

// Steps under the running player, in time with the feet: each foot that comes down to the floor
// and stops going down — the bottom of its swing — is a step, and a step sound at random goes out
// from there (Sfx.walk). The animation is baked, so the bones themselves do not move; the toes
// are followed through sockets of the skeleton's animation, set up here at the start. Only while
// the player walks under their own power: no steps in a jump or a throw, none standing still.
@ccclass("Footsteps")
export class Footsteps extends Component {
	@property({ tooltip: "Names of the toe bones followed, left and right" })
	bones: string[] = ["mixamorig:LeftToeBase", "mixamorig:RightToeBase"];
	@property({ tooltip: "Share of a foot's swing, from its lowest, that counts as on the floor", slide: true, range: [0, 1, 0.05] })
	contact: number = 0.3;
	@property({ tooltip: "Seconds a foot waits before it can step again" })
	gap: number = 0.18;
	@property({ tooltip: "Volume of a step, on top of its own in the mix (Sfx)" })
	volume: number = 1;

	private _feet: Foot[] = [];
	/** Which of the steps' sounds comes next. */
	private _step = 0;
	private _movement: PlayerMovement = null;
	private _direction = v3();

	protected start(): void {
		this._movement = this.getComponent(PlayerMovement);
		const animation = this.getComponentInChildren(SkeletalAnimation);
		if (!animation) {
			return;
		}
		for (const name of this.bones) {
			const bone = this._find(animation.node, name);
			if (!bone) {
				continue;
			}
			// A socket: a node the baked animation keeps on the bone.
			const target = new Node(`Footstep:${name}`);
			animation.node.addChild(target);
			animation.sockets.push(new SkeletalAnimation.Socket(this._path(animation.node, bone), target));
			this._feet.push({ node: target, last: 0, falling: false, low: Infinity, high: -Infinity, since: 1 });
		}
		animation.rebuildSocketAnimations();
	}

	protected update(dt: number): void {
		if (!this._feet.length) {
			return;
		}
		const walking = !!this._movement && this._movement.enabled && !this._movement.locked && this._movement.moveDirection(this._direction);
		const ground = this.node.worldPosition.y;
		for (const foot of this._feet) {
			foot.since += dt;
			const height = foot.node.worldPosition.y - ground;
			// Its swing, drifting slowly so a change of clip is followed.
			foot.low = Math.min(foot.low + dt * 0.05, height);
			foot.high = Math.max(foot.high - dt * 0.05, height);
			const falling = height < foot.last - 1e-4;
			const onFloor = height <= foot.low + (foot.high - foot.low) * this.contact;
			// Down and no further: the foot has landed.
			if (walking && foot.falling && !falling && onFloor && foot.since >= this.gap) {
				foot.since = 0;
				// The steps' sounds in turn, round and round: picked at random, the same one came twice
				// running and the gait limped.
				Sfx.at(Sfx.walk[this._step++ % Sfx.walk.length], foot.node, this.volume);
			}
			foot.falling = falling;
			foot.last = height;
		}
	}

	private _find(root: Node, name: string): Node {
		let found: Node = null;
		root.walk((node: Node) => {
			if (!found && node.name === name) {
				found = node;
			}
		});
		return found;
	}

	/** The bone's path from the animation's node, as sockets take it. */
	private _path(root: Node, bone: Node): string {
		const parts: string[] = [];
		for (let at = bone; at && at !== root; at = at.parent) {
			parts.unshift(at.name);
		}
		return parts.join("/");
	}
}
